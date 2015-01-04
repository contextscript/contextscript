//TODO: other scripts button
window.initializeCtxScript = function(config){
  console.log("Initializing context script...");
  var context = {
    platform: {
      javascript: true
    },
    url: window.location.toString()
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
  context.q = q;
  //Beware that the result might not be present.
  var historyItem = {
    context: context
  };
  createBox('<span class="ctxscript-arrow">&gt;</span>' + q).addClass("ctxscript-prev");
  var ctxscript = {
    //TODO: rename $el?
    container: createBox('Loading...'),
    history: history,
    context: context,
    config: config,
    setResult: function(value){
      //TODO: This should only happen once.
      this.result = value;
      historyItem.result = value;
      var $resultContainer = this.container.find('.ctxscript-result');
      if($resultContainer.length > 0) {
        $resultContainer.text(value);
      }
    }
  };
  var evaluateResult = function(result){
    ctxscript.meta = result;
    var $bar = $('<div class="ctxscript-bar"><h1></h1></div>');
    //TODO Fill in template variables
    $bar.find('h1').text(result.context.q);
    var $links = $('<div class="ctxscript-links">');
    $links.append(
      $('<a class="ctxscript-source" target="_blank">Show Source</a>').prop({
        href: ctxscript.config.url + '/v0/scripts/' + result._id,
      })
    );
    $bar.append($links);
    ctxscript.container.append($bar);
    ctxscript.container.append('<div class="ctxscript-result"></div>');
    eval(
      traceur.Compiler.script(result.script)
    );
  };
  $.post(config.url + "/v0/search", {
    context: context,
    user: config.user,
    key: config.key
  }).success(function(rawResp){
    ctxscript.container.empty();
    historyItem.response = JSON.parse(rawResp);
    var resp = JSON.parse(rawResp);
    if (resp.hits.length === 0) {
      ctxscript.container.append(
        '<h4>No scripts found</h4>' +
        '<button class="ctxscript-btn ctxscript-search-btn">Create a script for this context</button>' +
        '<button class="ctxscript-btn ctxscript-search-btn">Request a script for this context</button>'
      );
    } else if (resp.hits.length === 1) {
      evaluateResult(resp.hits[0]);
    } else {
      //TODO Creation dates
      ctxscript.container.append("<h4>Multiple results:</h4>");
      var $results = $("<ul>");
      resp.hits.forEach(function(result){
        var $row = $('<li>');
        var $button = $('<button class="ctxscript-btn">')
          .text(result.context.q);
        $button.click(function(){
          ctxscript.container.append('<hr>');
          evaluateResult(result);
        });
        $row.append(
          $button,
          $('<a class="ctxscript-source">source</a>').prop({
            href: ctxscript.config.url + '/v0/scripts/' + result._id
          })
        );
        $results.append($row);
      });
      ctxscript.container.append($results);
    }
  }).fail(function(error, msg){
    console.log(error);
    ctxscript.container.html(
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
  doSearch($('#q').val());
  $('#q').val('');
});
$(document).on('keypress', '#q', function(e) {
  if(e.which == 13) {
    doSearch($('#q').val());
    $('#q').val('');
  }
});
$('.ctxscript-invoke').prop('disabled', false);
  var $suggestions = $('<div class="ctxscript-invoke ctxscript-box">');
  $suggestions.append('<sup>suggestions:</sup>');
  $('.ctxscript-container').append($suggestions);
});
});
};
