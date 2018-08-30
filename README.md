[![inventid logo](https://cdn.inventid.nl/assets/logo-horizontally-ba8ae38ab1f53863fa4e99b977eaa1c7.png)](http://opensource.inventid.nl)

[![Maintainability](https://api.codeclimate.com/v1/badges/2a3154e29a838ece025b/maintainability)](https://codeclimate.com/github/inventid/opengraph-cacher/maintainability)
[![Test Coverage](https://api.codeclimate.com/v1/badges/2a3154e29a838ece025b/test_coverage)](https://codeclimate.com/github/inventid/opengraph-cacher/test_coverage)
[![Dependency Status](https://gemnasium.com/badges/github.com/inventid/opengraph-cacher.svg)](https://gemnasium.com/github.com/inventid/opengraph-cacher)

# Opengraph Cacher

Serving Opengraph data as a service

## What

This project aims to be a simple service for internal use to fetch opengraph data in a structured fashion.

Additionally it caches the results for a configurable time in an Elasticsearch instance.

```json
{
	"_url": "https://www.werkenbijderechtspraak.nl/",
	"_scrapedAt": 1487334683528,
	"_cacheResponse": false,
	"data": {
		"locale": [{
			"value": "nl_NL"
		}],
		"type": [{
			"value": "website"
		}],
		"title": [{
			"value": "Werken bij de Rechtspraak"
		}],
		"description": [{
			"value": "Op zoek naar een baan die er toe doet? De Rechtspraak heeft geregeld vacatures voor nieuwe collega's in juridische, staf of ICT functies"
		}],
		"url": [{
			"value": "https://www.werkenbijderechtspraak.nl/"
		}],
		"site_name": [{
			"value": "Werken bij de Rechtspraak"
		}],
		"twitter_card": [{
			"value": "summary"
		}],
		"twitter_description": [{
			"value": "Op zoek naar een baan die er toe doet? De Rechtspraak heeft geregeld vacatures voor nieuwe collega's in juridische, staf of ICT functies"
		}],
		"twitter_title": [{
			"value": "Werken bij de Rechtspraak"
		}],
		"twitter_site": [{
			"value": "@rechtspraakbaan"
		}],
		"twitter_creator": [{
			"value": "@rechtspraakbaan"
		}],
		"image": [{
			"value": {
				"value": "https://d3pxfuwnql1xse.cloudfront.net/30b9376b5b94713347a6c5c37faf2d1deef6cf59?url=https%3A%2F%2Fwww.werkenbijderechtspraak.nl%2Fwp-content%2Fuploads%2F2016%2F08%2Fheader-3.jpg",
				"width": [{
					"value": "1600"
				}],
				"height": [{
					"value": "220"
				}],
				"type": [{
					"value": null
				}]
			}
		}],
		"twitter_image": [{
			"value": {
				"value": "https://d3pxfuwnql1xse.cloudfront.net/30b9376b5b94713347a6c5c37faf2d1deef6cf59?url=https%3A%2F%2Fwww.werkenbijderechtspraak.nl%2Fwp-content%2Fuploads%2F2016%2F08%2Fheader-3.jpg",
				"width": [{
					"value": null
				}],
				"height": [{
					"value": null
				}],
				"alt": [{
					"value": null
				}]
			}
		}]
	}
}
```

## Elasticsearch

The service will automatically create an index the first time save is performed.
There are no special mappings required for the service.

## Camo images

In order to ensure clients can requests clients from http over https the [camo](https://github.com/atmos/camo) service can be used. If the environment variables `CAMO_HOST` and `CAMO_KEY` are set, images are automatically rewritten to use the defined camo instance.

## Docker

A Docker container is available.
Configuration is done using some command line variables.

An example is:

```bash
docker run \
    -e ES_URL=es.inventid.net:9200 \
    -e ES_INDEX=opengraph \
    -e ES_TYPE=cache \
    -e ES_VERSION=1.7 \
    -e CACHE_IN_DAYS=4 \
    -p 7070:7070 \
    inventid/opengraph-cacher
```

Example without elasticsearch:

    docker run -p 7070:7070 inventid/opengraph-cacher

The `CACHE_IN_DAYS` variable can be omitted (which will fallback to 28 days).

## API

The service has three simple endpoints:

### GET /opengraph?url=your-escaped-url

Example: [http://localhost:7070/opengraph/?url=http%3A%2F%2Finventid.nl]()
ventid.nl).

### DELETE /opengraph?url=your-escaped-url

Delete it from the cache, if you have a cache enabled.

### GET /_health

To see if the container is online
