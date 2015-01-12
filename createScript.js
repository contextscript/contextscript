var $result = $(
  '<div>' +
    '<h4>Context</h4>' +
    '<pre id="context" class="editor"></pre>' +
    '<h4>Script</h4>' +
    '<pre id="script" class="editor"></pre>' +
    '<fieldset>' + 
      '<legend>' +
        '<button id="test" class="ctxscript-btn" style="display:inline;">' +
        'Test Run</button>' +
      '</legend>' +
      '<div class="test-container"></div>' +
    '</fieldset>' +
    '<div class="ctxscript-btn-group">' +
      '<button id="save" class="ctxscript-btn">Save</button>' +
      '<button id="publish" class="ctxscript-btn">Publish</button>' +
      ' <a href="https://github.com/contextscript/contextscript/blob/master/publishing.md" target="_blank">About Saving and Publishing</a>' +
    '</div>' +
  '</div>'
);
ctxscript.$el.append($result);
//TODO: Creating loading notice
System.import('ace/ace')
.then(function(){
  return System.import('github:nodeca/js-yaml@master/dist/js-yaml');
})
.then(function(YAML) {
  var prevContext;
  window.YAML = YAML;
  if(ctxscript.history.length > 0) {
    prevContext = ctxscript.history.slice(-1)[0].context;
  }
  var contextEditor = ace.edit($result.find("#context")[0]);
  //TODO: Make highlighting work
  //contextEditor.getSession().setMode("ace/mode/yaml");
  contextEditor.renderer.setShowGutter(false);
  contextEditor.setOption("maxLines", 12);
  contextEditor.setOption("minLines", 2);
  contextEditor.setOption("highlightActiveLine", false);
  if(prevContext) {
    contextEditor.getSession().setValue(
      "# The location is optional. If you specify a url href, \n" +
      "# it must exactly match the users url for script to be triggered.\n" +
      // extend is used to copy the prototype properties so they are serialized.
      YAML.dump($.extend({}, prevContext), 0, 2)
    );
  } else {
    contextEditor.getSession().setValue(
      YAML.dump({q:"Write a trigger phrase here..."}, 0, 2)
    );
  }
  var scriptEditor = ace.edit($result.find("#script")[0]);
  //scriptEditor.getSession().setMode("ace/mode/javascript");
  scriptEditor.renderer.setShowGutter(false);
  scriptEditor.setOption("maxLines", 12);
  scriptEditor.setOption("minLines", 3);
  scriptEditor.setOption("highlightActiveLine", false);
  scriptEditor.getSession().setValue('ctxscript.$el.text("Hello World!");');
  if(ctxscript.config.user) {
    var scriptId = ctxscript.config.user.id + '-' + Number(new Date());
    $result.find("#test").click(function ( e ) {
      var $testContainer = $result.find('.test-container');
      $testContainer.empty().html('<div class="ctxscript-result"></div>');
      var script = scriptEditor.getSession().getValue();
      var originalCtxscript = ctxscript;
      (function(){
        //Create a fake ctxscript variable for testing.
        var ctxscript = Object.create(originalCtxscript);
        ctxscript.$el = $testContainer;
        var scriptResult = eval(
          traceur.Compiler.script(script)
        );
      }());
    });
    $result.find("#save").click(function ( e ) {
      $(e.target).prop('disabled', true);
      $(e.target).text("saving...");
      ctxscript.apiPost('/v0/scripts', {
        _id: scriptId,
        context: YAML.safeLoad(contextEditor.getSession().getValue()),
        script: scriptEditor.getSession().getValue()
      }).fail(function(err){
        alert(JSON.stringify(err));
      }).always(function(resp){
        $(e.target).prop('disabled', false);
        $(e.target).text("save");
      });
    });
  } else {
    $result.find("#save").prop({
      disabled: true
    });
  }
}).catch(function(x) {
  throw x;
});
