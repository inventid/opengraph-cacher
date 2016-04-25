[![inventid logo](https://cdn.inventid.nl/assets/logo-horizontally-ba8ae38ab1f53863fa4e99b977eaa1c7.png)](http://opensource.inventid.nl)

[![Code Climate](https://codeclimate.com/github/inventid/opengraph-cacher/badges/gpa.svg)](https://codeclimate.com/github/inventid/opengraph-cacher)
[![Dependency Status](https://gemnasium.com/badges/github.com/inventid/opengraph-cacher.svg)](https://gemnasium.com/github.com/inventid/opengraph-cacher)

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

## Elasticsearch

The service will automatically create an index the first time save is performed.
There are no special mappings required for the service.

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
