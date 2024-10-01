import { readFileSync, writeFileSync } from 'fs';
import { clearDirectory, toTitleCase } from './utils.js';

clearDirectory('./scratch/co-ops/formatted/');

console.log('Formatting NOAA CO-OPS stations…');

const sourceStations = JSON.parse(readFileSync('./scratch/co-ops/source/all.json')).stations;

const ndbcStations = JSON.parse(readFileSync('./scratch/ndbc/all.json')).stations.children.map(item => item.station);
const ndbcStationsById = {};
for (let i in ndbcStations) {
  let station = ndbcStations[i];
  ndbcStationsById[station.id] = station;
}

const features = [];

const sensorTags = {
  "AIR GAP": {
    "monitoring:air_gap": "yes"
  },
  "Air Temperature": {
    "monitoring:air_temperature": "yes"
  },
  "ANALOG SENSOR 1": {},
  "Barometric Pressure": {
    "monitoring:air_pressure": "yes"
  },
  "Conductivity": {
    "monitoring:water_conductivity": "yes"
  },
  "Relative Humidity": {
    "monitoring:air_humidity": "yes"
  },
  "site": {},
  "Visibility": {
    "monitoring:visibility": "yes"
  },
  "Water Temperature": {
    "monitoring:water_temperature": "yes"
  },
  "Wind": {
    "monitoring:wind_direction": "yes",
    "monitoring:wind_speed": "yes"
  },

  "Acoustic WL": {
    "monitoring:water_level": "yes"
  },
  "Backup WL": {
    "monitoring:water_level": "yes"
  },
  "Microwave WL": {
    "monitoring:water_level": "yes"
  },
  "Pressure WL": {
    "monitoring:water_level": "yes"
  },
  "SAE WL": {
    "monitoring:water_level": "yes"
  },
  "Tsunami WL": {
    "monitoring:water_level": "yes"
  },
};

for (let i in sourceStations) {
  let station = sourceStations[i];
  let lat = parseFloat(station.lat);
  let lng = parseFloat(station.lng);
  let details = station.details;
  if (isNaN(lat) || isNaN(lng) || !details || !station.id.length) continue;

  let name = station.name;
  if (name === name.toUpperCase()) {
    name = toTitleCase(name);
  }

  let feature = {
    "geometry": {
      "type": "Point",
      "coordinates": [lng, lat]
    },
    "properties": {
      "name": name,
      "ref": station.id,
      "website": `https://tidesandcurrents.noaa.gov/stationhome.html?id=${station.id}`,
      "source": "CO-OPS Metadata API",
      "tidal": station.tidal === true ? "yes" : "no"
    },
    "state": station.state
  };
  let affiliations = station.affiliations?.replace('NWLORTS', 'NWLON,PORTS').split(',') || [''];
  if (affiliations.includes('TCOON')) {
    Object.assign(feature.properties, {
      "operator": "Texas Coastal Ocean Observation Network",
      "operator:short": "TCOON",
      "operator:wikidata": "Q130375316",
      "operator:type": "government",
    });
  } else {
    Object.assign(feature.properties, {
      "operator": "Center for Operational Oceanographic Products and Services",
      "operator:short": "CO-OPS",
      "operator:wikidata": "Q123032876",
      "operator:type": "government",
    });
  }
  if (station.shefcode) {
    feature.properties["shef:code"] = station.shefcode;
    let lcShef = station.shefcode.toLowerCase();
    let ndbcStation = ndbcStationsById[lcShef];
    if (ndbcStation) {
      feature.properties["website:1"] = `https://www.ndbc.noaa.gov/station_page.php?station=${lcShef}`;
      if (ndbcStation.elev) {
        feature.properties.ele = ndbcStation.elev;
        feature.properties["ele:datum"] = "MSL";
      }
      if (ndbcStation.type !== "fixed") {
        console.log(`Unexpected station type for ${station.id}: ${ndbcStation.type}`);
      }
      let coOpsAffiliations = ['', 'PORTS', 'NWLON', 'COASTAL'];
      let isCoOps = new Set(coOpsAffiliations).intersection(new Set(affiliations)).size;
      if (!["NOS/CO-OPS", "IOOS Partners"].includes(ndbcStation.pgm) || 
          (ndbcStation.pgm === "NOS/CO-OPS" && !isCoOps) ||
          (ndbcStation.pgm === "IOOS Partners" && !affiliations.includes('TCOON'))) {
        console.log(`Skipping station ${station.id} with unexpected affiliations "${station.affiliations}" and pgm "${ndbcStation.pgm}"`);
        continue;
      }
    }
  }
  let startDate = details.origyear || details.established;
  if (startDate) feature.properties.start_date = startDate.slice(0, 10);
  
  let sensors = station.sensors?.sensors;
  let hasWorkingSensor = sensors && sensors.find(sensor => sensor.name !== 'site' && sensor.status === 1);

  if (details.removed.length > 0) {
    feature.properties["removed:man_made"] = "monitoring_station";
    feature.properties.end_date = details.removed.slice(0, 10);
  } else if (!hasWorkingSensor) {
    feature.properties["disused:man_made"] = "monitoring_station";
  } else {
    feature.properties["man_made"] = "monitoring_station";
  }

  for (let j in sensors) {
    let sensor = sensors[j];
    if (sensor.status !== 1 || !sensor.name.length) continue;
    let tags = sensorTags[sensor.name];
    if (tags) {
      for (let key in tags) {
        feature.properties[key] = tags[key];
      }
    } else {
      console.log("Unknown sensor: " + sensor.name);
    }
  }
  features.push(feature);
}

const json = {
  type: "FeatureCollection",
  features: features
};

console.log(features.length);
console.log(`Writing data to './scratch/co-ops/formatted/all.geojson'`);
writeFileSync('./scratch/co-ops/formatted/all.geojson', JSON.stringify(json, null, 2));
