let ctrlTemplate = (templateContext)=>{
  //TODO: Add last saved date
  //TODO: Add indicator that shows if a script has been published or is queued.
  return `
    <div class="ctxscript-btn-group">
      <button
        id="save"
        class="ctxscript-btn"
        ${ templateContext.user ? '' : 'disabled' }>
        Save
      </button>
      <button id="publish"
        class="ctxscript-btn"
        disabled>
        Publish (WIP)
      </button>
      <a href="https://github.com/contextscript/contextscript/blob/master/publishing.md"
        target="_blank">
        About Saving and Publishing
      </a>
    </div>
    ${ !templateContext.user ?
      `<small>You must be signed into a contextscript.com account to save this script.</small>`
      : ""
    }
  `;
}
let template = (templateContext)=>{
  return `
    <style>
      .edit-area {
        border: 1px solid lightgray;
      }
      .ctxscript-editor fieldset {
        margin: 0 -3px;
        padding: 4px;
        border: 1px solid black;
        border-left: 0;
        border-right: 0;
      }
    </style>
    <div class="ctxscript-editor">
      <h4>Context</h4>
      <pre id="context" class="edit-area"></pre>
      <h4>Script</h4>
      <pre id="script" class="edit-area"></pre>
      <fieldset>
        <legend>
          <button id="test" class="ctxscript-btn" style="display:inline;">
          Test Run</button>
        </legend>
        <div class="test-container"></div>
      </fieldset>
      <div id="controls">${ ctrlTemplate(templateContext) }</div>
    </div>`;
};
ctxscript.$el.text('Loading editor...');
Promise.all([
  System.import('ace/ace'),
  System.import('github:nodeca/js-yaml@master/dist/js-yaml'),
  new Promise(function(resolve, reject){
    if(!ctxscript.args.id) return resolve();
    $.get(ctxscript.config.url + '/v0/contextscripts/' + ctxscript.args.id)
      .success(resolve).fail((resp)=>reject({reason: "missing", resp: resp}))
  })
]).then(function([ace, YAML, myContextScript]) {
  console.log(myContextScript);
  ctxscript.$el.html(template({
    user: ctxscript.config.user
  }));
  var prevContext;
  if(ctxscript.history.length > 0) {
    prevContext = ctxscript.history.slice(-1)[0].context;
  }
  var contextEditor = ace.edit(ctxscript.$el.find("#context")[0]);
  //TODO: Make highlighting work
  //contextEditor.getSession().setMode("ace/mode/yaml");
  contextEditor.renderer.setShowGutter(false);
  contextEditor.setOption("maxLines", 12);
  contextEditor.setOption("minLines", 2);
  contextEditor.setOption("highlightActiveLine", false);
  var createdContext;
  if(myContextScript) {
    createdContext = $.extend({}, myContextScript._source.context, true);
  } else if(prevContext) {
    createdContext = $.extend({}, prevContext, true);
  } else {
    createdContext = $.extend({}, ctxscript.context, {
      q:"Write a trigger phrase here..."
    }, true);
  }
  contextEditor.getSession().setValue(
    "# The location is optional. If you specify a url href, \n" +
    "# it must exactly match the users url for script to be triggered.\n" +
    // extend is used to copy the prototype properties so they are serialized.
    YAML.dump(createdContext, 0, 2)
  );
  var scriptEditor = ace.edit(ctxscript.$el.find("#script")[0]);
  //scriptEditor.getSession().setMode("ace/mode/javascript");
  scriptEditor.renderer.setShowGutter(false);
  scriptEditor.setOption("maxLines", 12);
  scriptEditor.setOption("minLines", 3);
  scriptEditor.setOption("highlightActiveLine", false);
  if(myContextScript) {
    scriptEditor.getSession().setValue(myContextScript._source.script);
  } else {
    scriptEditor.getSession().setValue('ctxscript.$el.text("Hello World!");');
  }
  ctxscript.$el.find("#test").click(function ( e ) {
    var $testContainer = ctxscript.$el.find('.test-container');
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
  var scriptId;
  if(myContextScript) {
    scriptId = myContextScript._id;
  } else if(ctxscript.config.user) {
    scriptId = ctxscript.config.user.id + '-' + Number(new Date());
  }
  ctxscript.$el.find("#save").click(function ( e ) {
    $(e.target).prop('disabled', true);
    $(e.target).text("Saving...");
    ctxscript.apiPost('/v0/scripts', {
      _id: scriptId,
      context: YAML.safeLoad(contextEditor.getSession().getValue()),
      script: scriptEditor.getSession().getValue()
    }).fail(function(err){
      alert(JSON.stringify(err));
    }).always(function(resp){
      console.log(resp);
      $(e.target).prop('disabled', false);
      $(e.target).text("Save");
    });
  });
  ctxscript.$el.find("#publish").click(function ( e ) {
    $(e.target).prop('disabled', true);
    $(e.target).text("Publishing...");
    ctxscript.apiPost('/v0/publish', {
      _id: scriptId,
      context: YAML.safeLoad(contextEditor.getSession().getValue()),
      script: scriptEditor.getSession().getValue()
    }).fail(function(err){
      alert(JSON.stringify(err));
    }).always(function(resp){
      console.log(resp);
      $(e.target).prop('disabled', false);
      $(e.target).text("Publish");
    });
  });
}).catch(function(err) {
  if(err.reason == "missing") {
    ctxscript.$el.text('Error: Could not find script with the given id.');
  } else {
    throw x;
  }
});
