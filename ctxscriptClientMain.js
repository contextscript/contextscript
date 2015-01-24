window.initializeCtxScript = function(config, options){
console.log("Initializing context script...");
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
var createCtxscriptAPI = function(extras){
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
      return $.post(config.url + path, newOptions);
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
var evaluateResult = function(result, ctxscript, extraArgs){
  ctxscript.meta = result;
  ctxscript.$el.addClass("ctxscript-bar");
  //TODO Fill in template variables
  ctxscript.args = $.extend({}, extraArgs, {});
  var title = result._source.context.q;
  if($.isArray(title)) {
    title = title.join(', ');
  }
  ctxscript.$el.append($('<h1>').text(title));
  var $controls = $('<div class="ctxscript-controls">');
  $controls.append(
    //TODO: Hook this button up.
    $('<a class="ctxscript-source" target="_blank">Alternative Scripts</a>'),
    $('<a class="ctxscript-source" target="_blank">Show Source</a>').prop({
      href: ctxscript.config.url + '/contextscripts/' + result._id,
    })
  );
  $controls.hide();
  ctxscript.$el.append($controls);
  //TODO: Create a button for toggling the controls.
  ctxscript.$el.click(function(){
    $controls.toggle();
  });
  ctxscript.$el = createBox();
  ctxscript.$el.append('<div class="ctxscript-result"></div>');
  eval(
    traceur.Compiler.script(result._source.script)
  );
};
var doSearch = function(q){
  var currentContext = Object.create(context);
  currentContext.q = q;
  //Beware that the result might not be present.
  var historyItem = {
    context: currentContext
  };
  createBox('<span class="ctxscript-arrow">&gt;</span>' + q)
    .addClass("ctxscript-prev");
  var ctxscript = createCtxscriptAPI({
    $el: createBox('Loading...'),
    history: history,
    context: currentContext
  });
  historyItem.resultPromise = ctxscript.resultPromise;
  
  ctxscript.apiPost("/v0/search", {
    context: currentContext
  }).success(function(resp){
    historyItem.response = resp;
    ctxscript.$el.empty();
    if (resp.hits.length === 0) {
      ctxscript.$el.append(
        '<h4>No scripts found</h4>' +
        '<button class="ctxscript-btn ctxscript-search-btn">Create a script for this context</button>' +
        '<button class="ctxscript-btn ctxscript-search-btn">Request a script for this context</button>'
      );
    } else if (resp.hits.length === 1) {
      evaluateResult(resp.hits[0], ctxscript);
    } else {
      // If there is one hit with a much higher score than the others
      // that will be shown instead of the multiple result list.
      var hitsAboveThreshold = resp.hits.filter(function(hit){
        return hit._score > (resp.max_score / 2);
      });
      if(hitsAboveThreshold.length == 1) {
          evaluateResult(hitsAboveThreshold[0], ctxscript);
          return;
      }
      //TODO Creation dates and other meta-data
      ctxscript.$el.append("<h4>Multiple results:</h4>");
      var $results = $("<ul>");
      resp.hits.forEach(function(result){
        var $row = $('<li>');
        var $button = $('<button class="ctxscript-btn">')
          .text(result._source.context.q);
        $button.click(function(){
          ctxscript.$el.empty();
          evaluateResult(result, ctxscript);
        });
        $row.append(
          $button,
          $('<a class="ctxscript-source">source</a>').prop({
            href: ctxscript.config.url + '/contextscripts/' + result._id
          })
        );
        $results.append($row);
      });
      ctxscript.$el.append($results);
    }
  }).fail(function(error, msg){
    console.log(error);
    ctxscript.$el.html(
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
    context: currentContext
  };
  var ctxscript = createCtxscriptAPI({
    $el: createBox('Loading...'),
    history: history,
    context: currentContext
  });
  historyItem.resultPromise = ctxscript.resultPromise;
  $.getJSON(config.url + '/v0/contextscripts/' + options.scriptId)
  .success(function(result){
    historyItem.response = result;
    ctxscript.$el.empty();
    evaluateResult(result, ctxscript, options.args);
  });
  history = history.concat(historyItem);
}
});
});
};
