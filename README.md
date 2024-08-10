# Tool for maintaining USGS monitoring sites in OpenStreetMap

## To update OSM

1. Query for existing USGS sites in OSM:

```
[out:json][timeout:60];
// do not limit to the US since some sites are in Canada
node["man_made"="monitoring_station"]["operator:wikidata"="Q193755"]["ref"];
(._;>;); out meta;
```

2. Save the returned JSON to `./osm/downloaded.json`.
3. Run `npm run diff` to generate OSMChange files to `./diff/`.
4. Use JOSM to upload the OSMChange files to OSM.