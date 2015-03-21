window.initializeCtxScript = function(config, options){
console.log("Initializing context script...");
var VERSION = "0.0.0";
var context = {
  location: {
    href: window.location.href,
    host: window.location.host
  }
};
var history = [];
System.import("jquery@2.1").then(function(jQuery) {
var $ = jQuery;
$(function(){
var $mainContainer = $(options.container);
var createContextScriptAPI = function(extras){
  var __resolveResult;
  var resultPromise = new Promise(function(resolveResult){
    __resolveResult = resolveResult;
  });
  return $.extend({
    config: config,
    apiPost: function(path, options){
      var newOptions = $.extend({}, options, {
        user: config.user
      });
      // Forcing https because firefox is having trouble with x-origin http requests.
      return $.post(config.url.replace(/(.{0,6}\/\/)/, "https://") + path, newOptions);
    },
    setResult: function(value){
      __resolveResult(value);
      var $resultContainer = this.$el.find('.ctxscript-result');
      if($resultContainer.length > 0) {
        $resultContainer.append('<h4>Result:</h4>');
        if($.type(value) === "string") {
          $resultContainer.append($('<textarea readonly=true>').text(value));
        } else {
          //TODO: Display result with JSON tree viewer.
          $resultContainer.append($('<textarea readonly=true>')
            .text(JSON.stringify(value, 0, 2)));
        }
      }
    },
    getPrevHistItem: function(){
      if(!this.history || history.length === 0) return null;
      return this.history.slice(-1)[0];
    },
    getPrevResultPromise: function(){
      var prevHistItem = this.getPrevHistItem();
      if(prevHistItem) return prevHistItem.resultPromise;
      return null;
    },
    getPrevEvaledCtxScript: function(){
      var prevHistItem = this.getPrevHistItem();
      if(prevHistItem) return prevHistItem.evaledCtxScript;
      return null;
    },
    resultPromise: resultPromise
  }, extras);
};
var createBox = function(output){
  var $box = $('<div class="ctxscript-box">');
  $box.append(output);
  $mainContainer.find('#ctxscript-out').append($box);
  return $box;
};
$mainContainer.on('click', '.ctxscript-search-btn', function ( e ) {
  doSearch($(e.target).text());
});
//Preload:
System.import("handlebars");
System.import("github:nathanathan/fuzzyTemplateMatcher@gh-pages/fuzzyTemplateMatcher");
var evalContextScript = function(result, cxsAPI, extraArgs){
//TODO: Use polyfill.
Promise.all([
  System.import("handlebars"),
  System.import("github:nathanathan/fuzzyTemplateMatcher@gh-pages/fuzzyTemplateMatcher")
])
.then(function(imports){
  var handlebars = imports[0];
  var ftm = imports[1];
  if(cxsAPI.currentHistoryItem) {
    cxsAPI.currentHistoryItem.evaledCtxScript = result;
  }
  cxsAPI.$el.addClass("ctxscript-bar");
  cxsAPI.args = $.extend({}, extraArgs, {});
  var chosenQItem;
  var q = result._source.context.q;
  if(!$.isArray(q)) q = [q];
  var requestQ;
  if(cxsAPI.context) requestQ = cxsAPI.context.q;
  if(requestQ) {
    var bestMatch;
    q.forEach(function(qItem){
      var ftmResult = ftm(requestQ, qItem);
      if(!bestMatch || ftmResult.adjustedLd < bestMatch.adjustedLd) {
        chosenQItem = qItem;
        bestMatch = ftmResult;
      }
    });
    var newArgs = {};
    bestMatch.vars.forEach(function(v){
      newArgs[v.vName] = v.value;
    });
    cxsAPI.args = $.extend(newArgs, cxsAPI.args);
  } else {
    // If there is not a request q, use any user supplied args to
    // choose the best matching qItem.
    var bestCount;
    q.forEach(function(qItem){
      var matchingKeys = ftm("", qItem).vars.reduce(function(sofar, cur){
        return sofar + (cur.vName in cxsAPI.args ? 1 : 0);
      }, 0);
      if(!bestCount || matchingKeys > bestCount) {
        chosenQItem = qItem;
        bestCount = matchingKeys;
      }
    });
  }

  cxsAPI.qItem = chosenQItem;
  var quotedArgContext = {};
  Object.keys(cxsAPI.args).forEach(function(argName){
    quotedArgContext[argName] = "{{" + cxsAPI.args[argName] + "}}";
  });
  var title = handlebars.compile(chosenQItem)(quotedArgContext);
  cxsAPI.$el.append(
    $('<h1 class="ctxscript-open-menu">')
      .text(title)
      .append('<span class="ctxscript-d-arrow">')
  );
  var $controls = $('<div class="ctxscript-controls">');
  $controls.append(
    //TODO: Hook this button up.
    $('<a class="ctxscript-source" target="_blank">Alternative Scripts</a>'),
    $('<a class="ctxscript-source" target="_blank">Show Source</a>').prop({
      href: cxsAPI.config.url + '/contextscripts/' + result._id,
    })
  );
  $controls.hide();
  cxsAPI.$el.append($controls);
  
  cxsAPI.$el.find('.ctxscript-open-menu').click(function(){
    $controls.toggle();
  });
  cxsAPI.$el = createBox();
  cxsAPI.$el.append('<div class="ctxscript-result"></div>');
  eval(
    traceur.Compiler.script(result._source.script)
  );
  //Cause the side pane to scroll down to show the input box.
  //TODO: this doesn't quite work...
  $mainContainer.scrollTop($mainContainer[0].scrollHeight);
});
};
var doSearch = function(q){
  var currentContext = Object.create(context);
  currentContext.q = q;
  //Beware that the result might not be present.
  var historyItem = {
    searchContext: currentContext
  };
  createBox('<span class="ctxscript-arrow">&gt;</span>' + q)
    .addClass("ctxscript-prev");
  var cxsAPI = createContextScriptAPI({
    $el: createBox('Loading...'),
    history: history,
    context: currentContext,
    currentHistoryItem: historyItem
  });
  historyItem.resultPromise = cxsAPI.resultPromise;
  
  cxsAPI.apiPost("/v0/search", {
    context: currentContext
  }).success(function(resp){
    historyItem.response = resp;
    cxsAPI.$el.empty();
    if (resp.hits.length === 0) {
      cxsAPI.$el.append(
        '<h4>No scripts found</h4>' +
        '<button class="ctxscript-btn ctxscript-search-btn">Create a script for this context</button>' +
        '<button class="ctxscript-btn ctxscript-search-btn">Request a script for this context</button>'
      );
    } else if (resp.hits.length === 1) {
      evalContextScript(resp.hits[0], cxsAPI);
    } else {
      // If there is one hit with a much higher score than the others
      // that will be shown instead of the multiple result list.
      var hitsAboveThreshold = resp.hits.filter(function(hit){
        return hit._score > (resp.max_score / 2);
      });
      if(hitsAboveThreshold.length == 1) {
          evalContextScript(hitsAboveThreshold[0], cxsAPI);
          return;
      }
      //TODO Creation dates and other meta-data
      cxsAPI.$el.append("<h4>Multiple results:</h4>");
      var $results = $("<ul>");
      resp.hits.forEach(function(result){
        var $row = $('<li>');
        var $button = $('<button class="ctxscript-btn">')
          .text(result._source.context.q);
        $button.click(function(){
          cxsAPI.$el.empty();
          evalContextScript(result, cxsAPI);
        });
        $row.append(
          $button,
          $('<a class="ctxscript-source">source</a>').prop({
            href: cxsAPI.config.url + '/contextscripts/' + result._id
          })
        );
        $results.append($row);
      });
      cxsAPI.$el.append($results);
    }
  }).fail(function(error, msg){
    console.log(error);
    cxsAPI.$el.html(
        '<h4>Error</h4>' +
        '<p>' +
          error.status + ": " + error.statusText +
        '</p>'
    );
  });
  //Create new history array so that this context isn't included in the history
  //passed to the script.
  history = history.concat(historyItem);
};
$mainContainer.on('click', '.ctxscript-invoke', function ( e ) {
  var $q = $mainContainer.find('#ctxscript-q');
  doSearch($q.val());
  $q.val('');
});
$mainContainer.on('click', '.ctxscript-settings-btn', function ( e ) {
  $mainContainer.find('.ctxscript-settings').toggle();
});
$mainContainer.on('click', '.ctxscript-close', function ( e ) {
  $mainContainer.hide();
});
$mainContainer.on('click', '.ctxscript-about', function ( e ) {
  //The injection script could go out of sync with this one,
  //so it is versioned separately.
  //TODO: Make ctxscript alerts that allow copy/paste
  alert(
    "Version: " + VERSION + '-' + config.version +
    "\nUser Id: " + (config.user && config.user.id) +
    "\nServer URL: " + config.url
  );
});
//TODO: Go though command history with up/down arrows
$mainContainer.on('keypress', '#ctxscript-q', function(e) {
  if(e.which == 13) {
    var $q = $mainContainer.find('#ctxscript-q');
    doSearch($q.val());
    $q.val('');
  }
});
$mainContainer.find('.ctxscript-invoke').prop('disabled', false);
$mainContainer.find('.ctxscript-settings-btn').prop('disabled', false);
//TODO: Create suggestions box
//var $suggestions = $('<div class="ctxscript-box">');
//$suggestions.append('<sup>suggestions:</sup>');
//$mainContainer.append($suggestions);
if(options.scriptId) {
  var currentContext = Object.create(context);
  var historyItem = {
    searchContext: currentContext
  };
  var cxsAPI = createContextScriptAPI({
    $el: createBox('Loading...'),
    history: history,
    context: currentContext,
    currentHistoryItem: historyItem
  });
  historyItem.resultPromise = cxsAPI.resultPromise;
  $.getJSON(config.url + '/v0/contextscripts/' + options.scriptId)
  .success(function(result){
    historyItem.response = result;
    cxsAPI.$el.empty();
    evalContextScript(result, cxsAPI, options.args);
  });
  history = history.concat(historyItem);
}
});
});
};
