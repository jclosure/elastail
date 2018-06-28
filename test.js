import test from 'ava'
const ansiRegex = require('ansi-regex'),
      _ = require('lodash'),
      clc = require('cli-color'),
      ansiStrip = require('cli-color/strip')

const elastail = require('./elastail.js')


/**************************************************
 **
 **  Formatters
 **
 ***************************************************/

test('formatting nested objects to logfmt', t => {
  var obj = JSON.parse(`{
    "@timestamp": "2018-28-01 20:44:38.206",
    "application": "ecto",
    "file": "./deps/ecto/lib/ecto/log_entry.ex",
    "function": "log/1",
    "level": "debug",
    "line": 42,
    "message": "hi there",
    "payload": null,
    "service_name": "microservice_xyz",
    "nested": {"foo": [{"leg": "oof", "mar": "gee"}], "bar": 2}
  }`)

  var text = elastail.formatters._LOGFMT.stringify(obj)
  console.log(text)


  t.pass()
})

/**************************************************
 **
 **  Regex coloring
 **
 ***************************************************/

// REGEX: match data structure and behavior explained: https://gist.github.com/Integralist/5134943
test('can reassemble when there is ansi', t => {

  var text = 'a2-INFO-2-INFO-2'

  var regex = /([a-z]|\d|INFO)/gm

  var result = elastail.maybe_color_matches(text, regex)
  //console.log(result)

  t.is(ansiStrip(result), text, "Plain text still matches")

  var expected_asci_codes =
  ["\u001b[35m","\u001b[39m", // a
  "\u001b[35m","\u001b[39m",  // 2
  "\u001b[35m","\u001b[39m",  // INFO
  "\u001b[35m","\u001b[39m",  // 2
  "\u001b[35m","\u001b[39m",  // INFO
  "\u001b[35m","\u001b[39m"]; // 2

  var ansi_codes = result.match(ansiRegex())
  // console.log(JSON.stringify(ansi_codes))

  t.deepEqual(ansi_codes, expected_asci_codes, "Ansi codes should be wrapped around each match")

})
