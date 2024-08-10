# Tool for maintaining USGS monitoring sites in OpenStreetMap

## To update OSM

1. Run `npm run fetch_usgs` to download latest USGS sites from USGS.
2. Run `npm run format_usgs` to complile latest USGS data into GeoJSON with OSM tags.
3. Run `npm run fetch_osm` to download existing USGS sites from OSM.
4. Run `npm run diff` to generate OSMChange files to `./diff/`.
5. Use JOSM to upload the OSMChange files to OSM.