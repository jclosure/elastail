# elastail
Tails elasticsearch indices with a timestamp field.

## Install
This application uses ECMAScript 2015, also known as ES6.  To use it
ensure the environment has [recent version](https://nodejs.org/en/docs/es6/) of
node.js.

### Prepare environment
If you do not have nodejs installed, do one of the following:

Ubuntu/Debian
```
sudo apt-get install nodejs-legacy nvm
```

MacOS
```
brew install node
```

Ensure you have a modern version of node.

Check with:
```
node -v
```

If your version is older that 8.x, do the following.

Example:
```
curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.32.1/install.sh | bash
nvm install v8.9.4
```
Reopen console.  The version will now be as specified.

Alternative upgrade methods are described [here](http://www.hostingadvice.com/how-to/update-node-js-latest-version/).

### Installation

```
git clone https://github.com/jclosure/elastail.git
cd elastail
npm install -g
```

## Updating
```
cd elastail
git pull
npm update -g
```

The above commands are preconfigured wrappers that point to the urls and indices of our cloud Elasticsearch instances for logging.  Below are full details for `elastail` command-line usage.  The switches shown below can also be passed to the preconfigured wrappers shown above.

## Usage
```
export ES_HOSTPORT=http://localhost:9200
elastail --hostport=$ES_HOSTPORT --index='logstash-2018*'
elastail --hostport=$ES_HOSTPORT --index='logstash-2018*' --formatter=JSON
elastail --hostport=$ES_HOSTPORT --index='logstash-2018*' --formatter=LOGFMT
elastail --hostport=$ES_HOSTPORT --index='logstash-2018*' --formatter=PRETTY_LOG
```

### API

```
./elastail.js --help

	--hostport             default: http://localhost:9200
	--index                default: _all
		Valid index pattern available in es instance specified in --hostport

	--querystring          default: *
		Expects a lucene query string

	--from                 default: now-2m
		Can be of any valid Elasticsearch timevalue or Caclulation

	--formatter            default: LOGFMT [JSON, LOGFMT, REVERSIBLE_LOGFMT]
	--timestampfield       default: @timestamp
	--nolocalize           default: false
		Do not adjust timestampfield to local timezone

	--searchfile           default: ./default.search.json
	--regex                default: none
		If regext matches text in a line, each match is colored magenta to bring it to attention

	--regexflags           default: gm
	--raw                  default: false
	--nocolor              default: false
	--fetchsize=           default: 100
	-i|--refreshinterval=  default: 1000 (ms)
		How often a new search call is made

	--context=  default:{"index":"_all","from":"now-2m","fetchsize":100,"querystring":"*"}
		Context is what varables pass to the search template for json markup
```


## Filtering with grep

If you are using colored output, grep will truncate the colors from the piped
output and colorize where it begins matching.  This can lead to exotic looking
grepped logs.  The options to handle this are to do one of the following:

1. Don't use colored output when piping to grep (Recommended).  It's not useful anyway when grep owns the coloration of the pipe.

```bash
elastail --hostport=$ES_HOSTPORT --index='logstash-2018*' --nocolor | grep something
```

2. Pipe the text through `nocolor` (a sanitizer that removes the colors as it passes through).

```bash
elastail --hostport=$ES_HOSTPORT --index='logstash-2018*' | nocolor | grep something
```

## TODO

1. Colorized json option
2. Highlight fieldnames option
3. Make logger-specific fields optional so it will work with no logger-based data, e.g. telemetry (or any) fields
4. Evaluate changing --nocolor to use strip-ansi
5. Add the ability to specify a format string option for field layout (see es6-template-strings package)

## Credits
This project is inspired by https://github.com/ElasticSearchCLITools/esTail, but has significantly departed in features, api, and implementation.
