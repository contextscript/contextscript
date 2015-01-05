var $result = $(
  '<div>' +
    '<h4>Context</h4>' +
    '<pre id="context" class="editor"></pre>' +
    '<h4>Script</h4>' +
    '<pre id="script" class="editor"></pre>' +
    '<fieldset>' + 
      '<legend>' +
        '<button id="test" class="ctxscript-btn" style="display:inline;">' +
        'Test run</button>' +
      '</legend>' +
      '<div class="test-container"></div>' +
    '</fieldset>' +
    '<div class="ctxscript-btn-group">' +
      '<button id="save" class="ctxscript-btn">save</button>' +
      '<button id="publish" class="ctxscript-btn">publish</button>' +
    '</div>' +
  '</div>'
);
ctxscript.container.append($result);
System.import('ace/ace')
.then(function() {
  var prevContext;
  if(ctxscript.history.length > 0) {
    prevContext = ctxscript.history.slice(-1)[0].context;
  }
  var contextEditor = ace.edit($result.find("#context")[0]);
  //contextEditor.getSession().setMode("ace/mode/javascript");
  contextEditor.renderer.setShowGutter(false);
  contextEditor.renderer.setPadding(10);//??
  contextEditor.setOption("maxLines", 12);
  contextEditor.setOption("minLines", 2);
  contextEditor.setOption("highlightActiveLine", false);
  if(prevContext) {
    contextEditor.getSession().setValue(
      JSON.stringify(prevContext, 0, 2)
    );
  } else {
    contextEditor.getSession().setValue(
      JSON.stringify({q:"Write a trigger phrase here..."}, 0, 2)
    );
  }
  var scriptEditor = ace.edit($result.find("#script")[0]);
  //scriptEditor.getSession().setMode("ace/mode/javascript");
  scriptEditor.renderer.setShowGutter(false);
  scriptEditor.setOption("maxLines", 12);
  scriptEditor.setOption("minLines", 3);
  scriptEditor.setOption("highlightActiveLine", false);
  var scriptId = ctxscript.config.user + '-' + Number(new Date());
  $result.find("#test").click(function ( e ) {
    var $testContainer = $result.find('.test-container');
    $testContainer.empty().html('<div class="ctxscript-result"></div>');
    var script = scriptEditor.getSession().getValue();
    var originalCtxscript = ctxscript;
    (function(){
      //Create a fake ctxscript variable for testing.
      var ctxscript = Object.create(originalCtxscript);
      ctxscript.container = $testContainer;
      var scriptResult = eval(
        traceur.Compiler.script(script)
      );
    }());
  });
  $result.find("#save").click(function ( e ) {
    $(e.target).prop('disabled', true);
    $(e.target).text("saving...");
    $.post(ctxscript.config.url + '/v0/scripts', {
      _id: scriptId,
      context: JSON.parse(contextEditor.getSession().getValue()),
      script: scriptEditor.getSession().getValue(),
      user: ctxscript.config.user,
      key: ctxscript.config.key
    }).fail(function(err){
      alert(JSON.stringify(err));
    }).always(function(resp){
      $(e.target).prop('disabled', false);
      $(e.target).text("save");
    });
  });
}).catch(function(x) {
  throw x;
});
