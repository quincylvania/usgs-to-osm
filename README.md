# Tool for maintaining USGS monitoring sites in OpenStreetMap

## To update OSM

1. Run `npm run fetch_osm` to download existing USGS sites from OSM.
2. Run `npm run diff` to generate OSMChange files to `./diff/`.
3. Use JOSM to upload the OSMChange files to OSM.