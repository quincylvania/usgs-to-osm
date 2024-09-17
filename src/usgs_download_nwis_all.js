import { writeFileSync } from 'fs';
import { get, clearDirectory } from './utils.js';

clearDirectory('./usgs/nwis/all/');
clearDirectory('./usgs/nwis/all/bystate/');

// some states error out for returning too much data so we need to do multiple queries and combine them
const regionBounds = {
  MN: {
    maxLat: 50.247,
    minLat: 42.407,
    minLon: -88.550,
    maxLon: -99.009
  }
};

const regionCodes = [
  // US states and territories (not all used)
  'AL', 'AK', 'AS', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FM', 'FL', 'GA', 'GU', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MH', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'MP', 'OH', 'OK', 'OR', 'PW', 'PA', 'PR', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VI', 'VA', 'WA', 'WV', 'WI', 'WY',
  // Canadian provinces and territories (not all used)
  'MB', 'SK', 'BC', 'AB', 'QC', 'ON', 'NB', 'YT', 'NL', 'PE', 'NT', 'NU', 'NS',
  // USGS internal codes (not all used even though they're listed on the USGS site)
  'AQ', // American Samoa
  'EQ', // Canton and Enderbury Islands
  'JQ', // Johnston Atoll
  'MQ', // Midway Islands
  'YQ', // Southern Ryukyu Islands
  'SQ', // Swan Island
  'TQ', // Trust Territory of the Pacific Islands
  'BQ', // U.S. Misc. Caribbean Islands
  'IQ', // U.S. Misc. Pacific Islands
  'WQ', // Wake Island
];

// some regions don't have data (but still fetch them in case they have future data)
const noDataExpectedForCodes = [
  'AB', 'AS', 'BQ', 'EQ', 'FM', 'IQ', 'JQ', 'MB', 'MH', 'MQ', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'PW', 'QC', 'SK', 'SQ', 'TQ', 'WQ', 'YQ', 'YT',
];

function buildUrlForAll(regionCode, bbox) {
  regionCode = regionCode.toLowerCase();
  let url = `https://nwis.waterdata.usgs.gov/nwis/inventory?state_cd=${regionCode}`;
  if (bbox) {
    url += `&nw_longitude_va=${bbox.maxLon}&nw_latitude_va=${bbox.maxLat}&se_longitude_va=${bbox.minLon}&se_latitude_va=${bbox.minLat}&coordinate_format=decimal_degrees`;
  }
  url += `&group_key=NONE&format=sitefile_output&sitefile_output_format=rdb_file&column_name=agency_cd&column_name=site_no&column_name=station_nm&column_name=site_tp_cd&column_name=lat_va&column_name=long_va&column_name=dec_lat_va&column_name=dec_long_va&column_name=coord_meth_cd&column_name=coord_acy_cd&column_name=coord_datum_cd&column_name=dec_coord_datum_cd&column_name=district_cd&column_name=state_cd&column_name=county_cd&column_name=country_cd&column_name=land_net_ds&column_name=map_nm&column_name=map_scale_fc&column_name=alt_va&column_name=alt_meth_cd&column_name=alt_acy_va&column_name=alt_datum_cd&column_name=huc_cd&column_name=basin_cd&column_name=topo_cd&column_name=data_types_cd&column_name=instruments_cd&column_name=construction_dt&column_name=inventory_dt&column_name=drain_area_va&column_name=contrib_drain_area_va&column_name=tz_cd&column_name=local_time_fg&column_name=reliability_cd&column_name=gw_file_cd&column_name=nat_aqfr_cd&column_name=aqfr_cd&column_name=aqfr_type_cd&column_name=well_depth_va&column_name=hole_depth_va&column_name=depth_src_cd&column_name=project_no&column_name=rt_bol&column_name=peak_begin_date&column_name=peak_end_date&column_name=peak_count_nu&column_name=qw_begin_date&column_name=qw_end_date&column_name=qw_count_nu&column_name=gw_begin_date&column_name=gw_end_date&column_name=gw_count_nu&column_name=sv_begin_date&column_name=sv_end_date&column_name=sv_count_nu&list_of_search_criteria=state_cd`;
  return url;
}

console.log('Fetching latest data for all 1,700,000+ USGS NWIS sites. This may take some times…');

for (let i in regionCodes) {
  let regionCode = regionCodes[i];
  if (regionBounds[regionCode]) {
    let bbox1 = Object.assign({}, regionBounds[regionCode]);
    let bbox2 = Object.assign({}, regionBounds[regionCode]);
    let midLat = bbox1.minLat + (bbox1.maxLat - bbox1.minLat) / 2;
    bbox1.minLat = midLat;
    bbox2.maxLat = midLat;
    await getAndSave([
      buildUrlForAll(regionCode, bbox1),
      buildUrlForAll(regionCode, bbox2),
    ], `./usgs/nwis/all/bystate/${regionCode}.csv`);
  } else {
    // don't fetch async becasue we don't want to strain the USGS servers
    await getAndSave(buildUrlForAll(regionCode), `./usgs/nwis/all/bystate/${regionCode}.csv`, noDataExpectedForCodes.includes(regionCode));
  }
}

async function getAndSave(remoteUrls, localUrl, expectNoData) {
  if (!Array.isArray(remoteUrls)) {
    remoteUrls = [remoteUrls];
  }
  let completedResponses = 0;
  let totalReponse = "";

  for (let i in remoteUrls) {
    let remoteUrl = remoteUrls[i];
    await get(remoteUrl).then(function(response) {
      
      // expect a commented description above data
      if (response[0] === "#") {
        // remove the description
        response = response.split('\n').slice(75);
        // remove string length row below headers
        response.splice(1, 1);
        // join back together
        response = response.join('\n');
        if (totalReponse.length) {
          // add data but without the header row
          totalReponse += response.split('\n').slice(1).join('\n');
        } else {
          totalReponse = response;
        }
      } else {
        // otherwise only an error page was returned
        totalReponse += "";
      }
      completedResponses += 1;
      if (completedResponses === remoteUrls.length) save();
    });
  }

  function save() {
    if (totalReponse.length || !expectNoData) {
      console.log(`Writing to ${localUrl}`);
      writeFileSync(localUrl, totalReponse);
    }
    if (!totalReponse.length && !expectNoData) {
      console.log(`Unexpectedly found no data to save to ${localUrl}`);
    } 
  }
}
