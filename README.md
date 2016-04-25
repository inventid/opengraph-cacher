# Opengraph Cacher

Serving Opengraph data as a service

## What

This project aims to be a simple service for internal use to fetch opengraph data in a structured fashion.
It will return the data similar to the [open-graph-scraper](https://github.com/jshemas/openGraphScraper) project.

Additionally it caches the results for a configurable time in an Elasticsearch instance.

```json
{
	"ogTitle": "Buy your tickets too!",
	"ogDescription": "Fancy going as well? Buy your tickets now!",
	"ogImage": {
		"url": "https://ndchannel.files.wordpress.com/2011/09/h-artistry2bat2bmiecc2bin2boctober2blast2byear.jpg?size=huge",
		"width": "1800",
		"height": "1800"
	}
}
```

## Docker

A Docker container is available.
Configuration is done using some command line variables.

An example is:

```bash
docker run
    -e ES_URL=es.inventid.net:9200
    -e ES_INDEX=opengraph
    -e ES_TYPE=cache 
    -e ES_VERSION=1.7
    -e CACHE_IN_DAYS=4 
    -p 7070:7070
    inventid/opengraph-cacher
```

The `CACHE_IN_DAYS` variable can be omitted (which will fallback to 28 days).

