#!/usr/bin/env node

/**************************************************
 **
 ** Requirements
 **
 ***************************************************/
var minimist = require('minimist'),
    elasticsearch = require('elasticsearch'),
    markupjs = require('markup-js'),
    fs = require('fs'),
    clc = require('cli-color'),
    moment = require('moment'),
    _ = require('lodash')

var argv = minimist(process.argv.slice(2))

/**************************************************
 **
 ** Formatters
 **
 ***************************************************/
var formatters = {

  _LOGFMT: new function() {
    this.stringify = (obj) => {
      if (obj && typeof obj == 'object') {
        var text = Object.keys(obj)
          .map(key => {
            var val = obj[key]
            if (val && typeof val == 'object') {
              // NOTE: Here we are assuming some particular formatted delimiters
              // for arrays and objects. This should be considered for language
              // agnosticity
              if (Array.isArray(val)) {
                return [key, "[" + val.map(v => this.stringify(v)) + "]"]
              }
              else {
                return [key, "{" + this.stringify(val) + "}"]
              }
            }
            else {
              return [key, val]
            }
          })
          .map(tup => {
            [key, val] = tup
            return `${key}=${val}`
          })
          .join(', ')

        return text
      }
      else {
        return obj
      }

    }
  },

  // custom formatter that cleans up the text for our purposes
  LOGFMT: new function () {
    this.stringify = (obj) => {
      //strip_escaped_quotes_from_object_string_props(obj)

      // TODO: make a switch for this
      // highlight_field_names(obj)

      var text = formatters._LOGFMT.stringify(obj)
      text = maybe_color_matches(text, regex)
      var level = obj['level']
      if (coloroutput) {
          return color_for_level(text) + '\n'
      } else {
          return text + '\n'
      }
    }
  },

  PRETTY_LOG: new function() {
    this.stringify = (obj) => {
      // strip_escaped_quotes_from_object_string_props(obj)
      maybe_color_matches_object(obj, regex)
      if (coloroutput) {
        return clc.gray(obj[timestampfield] + ": ")
          + clc.gray(obj['level'].toUpperCase() + ": ")
          + obj['service_name'] + ": "
          + clc.gray(obj['file'] + ": "
          + obj['line'] + ": ")
          + color_for_level(obj['message'], obj['level'])
      }
      else {
        return obj[timestampfield] + ": "
        + obj['level'].toUpperCase() + ": "
        + obj['service_name'] + ": "
        + obj['file'] + ": "
        + obj['line'] + ": "
        + obj['message']
      }
    }
  },

  JSON: new function() {
    this.stringify = (obj) => {
      var text = JSON.stringify(obj, null, 2)
      text = maybe_color_matches(text, regex)
      if (coloroutput) {
          return color_for_level(text, obj['level'])
      } else {
          return text
      }
    }
  }

}

/**************************************************
 **
 ** Varables
 **
 ***************************************************/
// Display all fields default=undefined
var output = []

// Is regex flag and the REGEX expression
var regex = false
// default flags for regex g m i
var regexflags = "gm"
// Display entire hit in JSON format or just deplay the message
var rawoutput

// Count of documents retrieved which tells us when the scan/scroll is finished
// flag when the search scan/scoll is retrieved
var searchDone = true
// the Host to connect to
var hostportlist = ["https://search-logging-test-5nz6hhviyqfg76hfjmxssfyl5a.us-east-1.es.amazonaws.com"]
// How often to query the index
var refreshinterval = 3000
// Default search template (json markup)
var searchfile = __dirname + "/default.search.json"
// The DSL Query to Elasticsearch - I'll probably set a default so the script has no requirements to just work
var searchTemplate = ""
// set loglevel
var loglevel = "error"

// TODO(jholder): Fix or make --from= work
// This is used for the JSON Markup - I'll probably add a file option
var context = {
  index: "_all",
  from: "now-2m", // NOTE: Not settable from cli yet
  fetchsize: 100,
  querystring: "*"
}

var formatter = formatters.LOGFMT
// Add color output
var coloroutput = true

// default timestamp key
var timestampfield = '@timestamp'
var localizetimestamp = true

// NOTE: empty list means all fields
var fields = []

// Disable Info messages (used only for debugging)
console.info = function() {}

/***************************************************
 **
 ** Setup
 **
 ***************************************************/
 clc.noop = str => str
 clc.gray = clc.blackBright
 clc.info = clc.INFO = clc.noop
 clc.debug = clc.DEBUG = clc.cyan
 clc.warn = clc.WARN = clc.warning = clc.WARNING = clc.yellow
 clc.error = clc.ERROR = clc.red
 clc.trace = clc.TRACE = clc.info

/*******************************
 **
 ** Process Command Line
 **
 ********************************/

// TODO: Rework as template
if (argv.h || argv.help || argv['?']) {
  console.log(process.argv[0] + ":")
  console.log("\t--hostport             default: " + hostportlist)
  console.log("\t--index                default: " + context.index)
  console.log("\t\tValid index pattern available in es instance specified in --hostport\n")
  console.log("\t--querystring          default: " + context.querystring)
  console.log("\t\tExpects a lucene query string\n")
  console.log("\t--from                 default: " + context.from)
  console.log("\t\tCan be of any valid Elasticsearch timevalue or Caclulation\n")
  console.log("\t--formatter            default: LOGFMT [JSON, LOGFMT, REVERSIBLE_LOGFMT]")

  // TODO: Change this so that its generic.  Some indices are not time-based
  console.log("\t--timestampfield       default: " + timestampfield)
  console.log("\t--nolocalize           default: false")

  console.log("\t\tDo not adjust timestampfield to local timezone\n")
  console.log("\t--searchfile           default: " + searchfile)
  console.log("\t--regex                default: none")
  console.log("\t\tIf regext matches text in a line, each match is colored magenta to bring it to attention\n")
  console.log("\t--regexflags           default: " + regexflags)
  console.log("\t--raw                  default: false ")
  console.log("\t--nocolor              default: false")
  console.log("\t--fetchsize=           default: 100 ")
  console.log("\t-i|--refreshinterval=  default: " + refreshinterval + " (ms)")
  console.log("\t\tHow often a new search call is made\n")
  console.log("\t--context=  default:" + JSON.stringify(context))
  console.log("\t\tContext is what varables pass to the search template for json markup\n")
  process.exit(1)
}

// setup context
if (argv.context) {
  if (isJSON(argv.context)) {
    json = JSON.parse(argv.context)
    console.log(json)
    context = _.merge(context, json)
  } else {
    console.error("Invalid context json.")
    process.exit(1)
  }
}
context.index = (argv.index || context.index)
context.fetchsize = (argv.fetchsize || context.fetchsize)
context.from = (argv.from || context.from)
context.querystring = (argv.querystring || context.querystring)

hostportlist = (argv.hostport || hostportlist)
formatter = ((argv.formatter && eval('formatters.'+argv.formatter.toUpperCase())) || formatter)

rawoutput = (argv.raw || rawoutput)
coloroutput = argv.nocolor ? !argv.nocolor : coloroutput
refreshinterval = (argv.i || argv.refreshinterval || refreshinterval)

regex = (argv.regex || regex)
regexflags = (argv.regexflags || regexflags)
regex = regex ? new RegExp(regex, regexflags) : regex

// load searchfile
searchfile = (argv.searchfile || searchfile)
if (fs.existsSync(searchfile)) {
    var searchTemplate = fs.readFileSync(searchfile, 'utf8')
    console.info(searchTemplate)
} else {
    console.error("file does not exist:" + searchfile)
    process.exit(2)
}

// timestamps
timestampfield = (argv.timestampfield || timestampfield)
localizetimestamp = argv.nolocalize ? !argv.nolocalize : localizetimestamp

/**************************************************
 **
 **  Open the Elasticsearch Connection
 **
 ***************************************************/
var client = new elasticsearch.Client({
    host: hostportlist,
    // sniffOnStart: true,
    // sniffInterval: 60000,
    index: context.index,
    keepAlive: true,
    ignore: [404],
    log: loglevel,
    suggestCompression: true
})

// Test Connection make sure it is available
client.ping({
    requestTimeout: 1000,
}, function(error) {
    if (error) {
        console.error('elasticsearch cluster maybe down!')
        process.exit(1)
    } else {
        console.log('Connected to Elasticsearch cluster.')
    }
})

/********************************************************************************
 **
 ** Functions
 **
 *********************************************************************************/

const printOutput = () => {

    while (output.length > 0) {
        var hit = output.shift()
        console.info("====" + hit + " of " + output.length)

        if (localizetimestamp) {
          localize_UTC_timestamp(hit._source)
        }

        // TODO: make a better way to default that doesn't assume level
        hit._source['level'] = level = (hit._source['level'] || 'info')

        // TODO: move to excluded fields flag
        remove_fields(hit._source, ['geo', 'tags', 'ansi_color'])

        var text = ""

        // stringify
        if (rawoutput) {
          text = JSON.stringify(hit, null, 2)
        } else {
          if (coloroutput) {
              text = color_for_level(formatter.stringify(hit._source), level)
          } else {
              text = formatter.stringify(hit._source)
          }
        }

        console.log(text)
    }
}

const doSearch = () => {
    console.info("Running search".blue)
    if (!searchDone) {
        console.log("Search Not Complete")
        return
    }
    // convert the Template to a valid search
    var search = markupjs.up(searchTemplate, context)

    // execute the Search
    client.search(JSON.parse(search), ph = function printHits(error, response) {
        // loop over the events
        if (error != undefined) {
            console.error("ERR:".red + error)
            return
        }
        console.info("INFO".yellow + "Count = " + response.hits.hits.length)

        // push each event into output variable
        response.hits.hits.forEach(function(hit) {
            output.push(hit)
        })
        // ff the retrieved docements equals the count then we are done
        printOutput()
        if (output.length >= response.hits.total) {
            searchDone = true
            console.info("Search complete".blue)
            return
        }
        // else query the scroll again to get more documents
        client.scroll({
            scrollId: response._scroll_id,
            scroll: '30s'
        }, ph)
    })
}

/********************************************************************************
 **
 ** Application
 **
 *********************************************************************************/
// set the loop for retrieving hits
setInterval(() => {
  if (searchDone) {
      doSearch()
  }
}, refreshinterval)


/********************************************************************************
 **
 ** Helpers
 **
 *********************************************************************************/

function localize_UTC_timestamp(obj) {
  // localize and sanitize ts output
  var ts = obj[timestampfield]
  if (ts) {
    var dateFormat = 'YYYY-DD-MM HH:mm:ss.SSS'
    var ts_utc = moment(ts, moment.ISO_8601)
    var ts_local = ts_utc.local()
    obj[timestampfield] = ts_local.format(dateFormat)
  }
  else {
    return obj
  }
}

// mutates obj by removing properties named by keys
function remove_fields(obj, keys) {
  for (i = 0; i < keys.length; i++) {
    delete obj[keys[i]]
  }
}

function color_for_level(str, level) {
  var fn = (clc[level] || clc.noop)
  return fn(str)
}

function highlight_field_names(obj) {
  /// replace keys with colored versions
  for (var key in obj) {
    val = obj[key]
    delete obj[key]
    obj[clc.bold(key)] = val
  }
}

function isJSON(str) {
   return !_.isError(_.attempt(JSON.parse, str))
}

function maybe_color_matches_object(obj, regex) {
  for (key in obj) {
    var val = obj[key]
    if (val) {
      val = maybe_color_matches(val, regex)
      obj[key] = val
    }
  }
}

function maybe_color_matches(text, regex) {
  if (regex) {
    // HACK: ensure text is text
    // TODO: don't mutate here
    text = text.toString()
    bits = []
    tlen = text.length
    pos = 0
    while (match = regex.exec(text)) {
      begin = match.index
      end = regex.lastIndex
      m = match[0].toString()
      console.info("matched: " + match + " at " + match.index + ' ' + regex.lastIndex)
      var pslice = text.slice(pos, begin)
      console.info(pslice)
      bits.push(pslice)
      mslice = clc.magenta(m)
      console.info(mslice)
      bits.push(mslice)
      pos = end
      console.info("----")
    }
    var eslice = text.slice(pos)
    bits.push(eslice)
    return bits.join('')
  }
  else {
    return text
  }
}

function strip_escaped_quotes_from_object_string_props(obj) {
  // TODO: Determine if we want this extra stripping
  // all_quotes_and_backslashes = /['\\"]/g
  escaped_quote_regex = /[\\]+["]/g
  for (var key in obj) {
    val = obj[key]
    if (_.isString(val)) {
      no_inner_quotes = val.replace(escaped_quote_regex, '')
      obj[key] = no_inner_quotes
    }
  }
}

// exported Functions
exports.maybe_color_matches = maybe_color_matches
exports.formatters = formatters
