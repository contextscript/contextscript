window.initializeCtxScript = function(config){
console.log("Initializing context script...");
var context = {
  location: {
    href: window.location.href,
    host: window.location.host
  }
};
var history = [];
System.import("jquery@2.1").then(function(jQuery) {
var $ = window.$;
if(jQuery && jQuery.fn && jQuery.fn.jquery) {
  $ = jQuery;
}
$(function(){
var createBox = function(output){
  var $box = $('<div class="ctxscript-box">');
  $box.append(output);
  $('#ctxscript-out').append($box);
  return $box;
};
$(document).on('click', '.ctxscript-search-btn', function ( e ) {
  doSearch($(e.target).text());
});
var doSearch = function(q){
  var currentContext = Object.create(context);
  currentContext.q = q;
  //Beware that the result might not be present.
  var historyItem = {
    context: currentContext
  };
  createBox('<span class="ctxscript-arrow">&gt;</span>' + q).addClass("ctxscript-prev");
  var ctxscript = {
    $el: createBox('Loading...'),
    history: history,
    context: currentContext,
    config: config,
    apiPost: function(path, options){
      var newOptions = $.extend({}, options, {
        user: config.user
      });
      return $.post(this.config.url + path, newOptions);
    },
    setResult: function(value){
      //TODO: This should only happen once.
      this.result = value;
      historyItem.result = value;
      var $resultContainer = this.$el.find('.ctxscript-result');
      if($resultContainer.length > 0) {
        $resultContainer.append('<h4>Result:</h4>');
        $resultContainer.append($('<textarea readonly=true>').text(value));
      }
    }
  };
  var evaluateResult = function(result){
    ctxscript.meta = result;
    ctxscript.$el.addClass("ctxscript-bar");
    //TODO Fill in template variables
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
        href: ctxscript.config.url + '/scripts/' + result._id,
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
  ctxscript.apiPost("/v0/search", {
    context: currentContext
  }).success(function(rawResp){
    ctxscript.$el.empty();
    historyItem.response = JSON.parse(rawResp);
    var resp = JSON.parse(rawResp);
    if (resp.hits.length === 0) {
      ctxscript.$el.append(
        '<h4>No scripts found</h4>' +
        '<button class="ctxscript-btn ctxscript-search-btn">Create a script for this context</button>' +
        '<button class="ctxscript-btn ctxscript-search-btn">Request a script for this context</button>'
      );
    } else if (resp.hits.length === 1) {
      evaluateResult(resp.hits[0]);
    } else {
      // If there is one hit with a much higher score than the others
      // that will be shown instead of the multiple result list.
      var hitsAboveThreshold = resp.hits.filter(function(hit){
        return hit._score > (resp.max_score / 2);
      });
      if(hitsAboveThreshold.length == 1) {
          evaluateResult(hitsAboveThreshold[0]);
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
          evaluateResult(result);
        });
        $row.append(
          $button,
          $('<a class="ctxscript-source">source</a>').prop({
            href: ctxscript.config.url + '/scripts/' + result._id
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
        '<p>Message: ' +
          msg +
        '</p>'
    );
  });
  //Create new history array so that this context isn't included in the history
  //passed to the script.
  history = history.concat(historyItem);
};
$(document).on('click', '.ctxscript-invoke', function ( e ) {
  doSearch($('#ctxscript-q').val());
  $('#ctxscript-q').val('');
});
$(document).on('click', '.ctxscript-settings-btn', function ( e ) {
  $('.ctxscript-settings').toggle();
});
$(document).on('click', '.ctxscript-close', function ( e ) {
  $('.ctxscript-container').hide();
});
//TODO: Go though command history with up/down arrows
$(document).on('keypress', '#ctxscript-q', function(e) {
  if(e.which == 13) {
    doSearch($('#ctxscript-q').val());
    $('#ctxscript-q').val('');
  }
});
$('.ctxscript-invoke').prop('disabled', false);
$('.ctxscript-settings-btn').prop('disabled', false);
//TODO: Create suggestions box
//var $suggestions = $('<div class="ctxscript-box">');
//$suggestions.append('<sup>suggestions:</sup>');
//$('.ctxscript-container').append($suggestions);
});
});
};
