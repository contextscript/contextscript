---
q:
  - "Edit script with id {{id}}"
  - "Create a script"
  - "Create a script for this context"
  - "Create a script from this one"
---
```javascript
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
        border: 1px solid gray;
        border-left: 0;
        border-right: 0;
        box-shadow: inset 0px 0px 2px gray;
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
cxsAPI.$el.text('Loading editor...');
Promise.all([
  System.import('ace/ace'),
  System.import('github:nodeca/js-yaml@master/dist/js-yaml'),
  new Promise(function(resolve, reject){
    if(!cxsAPI.args.id) return resolve();
    $.get(cxsAPI.config.url + '/v0/contextscripts/' + cxsAPI.args.id)
      .success(resolve).fail((resp)=>reject({reason: "missing", resp: resp}))
  })
]).then(function([ace, YAML, myContextScript]){
  cxsAPI.$el.html(template({
    user: cxsAPI.config.user
  }));
  //Set some defaults:
  var createdContext = $.extend({}, cxsAPI.context, {
    q:"Write a trigger phrase here..."
  }, true);
  var createdScript = 'cxsAPI.$el.text("Hello World!");';
  var scriptId = null;
  if(cxsAPI.config.user) {
    scriptId = cxsAPI.config.user.id + '-' + Number(new Date());
  }
  
  var qItemMap = {
    "Edit script with id {{id}}" : ()=>{
      $.extend({}, myContextScript._source.context, true);
      createdScript = myContextScript._source.script;
      scriptId = myContextScript._id;
    },
    "Create a script" : ()=>{
      //The defaults are fine. We don't need to do anything.
    },
    "Create a script for this context" : ()=>{
      //It's a bit ambiguous exactly which context "this" refers to.
      let prevHistItem = cxsAPI.getPrevHistItem();
      if(prevHistItem) {
        $.extend(createdContext, prevHistItem.context, true);
      }
    },
    "Create a script from this one" : ()=>{
      let prevCtxScript = cxsAPI.getPrevEvaledCtxScript();
      if(prevCtxScript) {
        $.extend({}, prevCtxScript._source.context, true);
        createdScript = prevCtxScript._source.script;
      } else {
        alert("Which one?");
      }
    }
  };
  if(cxsAPI.qItem in qItemMap) qItemMap[cxsAPI.qItem]();
  
  var contextEditor = ace.edit(cxsAPI.$el.find("#context")[0]);
  //TODO: Make highlighting work
  //contextEditor.getSession().setMode("ace/mode/yaml");
  contextEditor.renderer.setShowGutter(false);
  contextEditor.setOption("maxLines", 12);
  contextEditor.setOption("minLines", 2);
  contextEditor.setOption("highlightActiveLine", false);
  contextEditor.getSession().setValue(
    "# The location is optional. If you specify a url href, \n" +
    "# it must exactly match the users url for script to be triggered.\n" +
    // extend is used to copy the prototype properties so they are serialized.
    YAML.dump(createdContext, 0, 2)
  );
  var scriptEditor = ace.edit(cxsAPI.$el.find("#script")[0]);
  //scriptEditor.getSession().setMode("ace/mode/javascript");
  scriptEditor.renderer.setShowGutter(false);
  scriptEditor.setOption("maxLines", 12);
  scriptEditor.setOption("minLines", 3);
  scriptEditor.setOption("highlightActiveLine", false);
  scriptEditor.getSession().setValue(createdScript);

  cxsAPI.$el.find("#test").click(function ( e ) {
    var $testContainer = cxsAPI.$el.find('.test-container');
    $testContainer.empty().html('<div class="ctxscript-result"></div>');
    var script = scriptEditor.getSession().getValue();
    var originalCxsAPI = cxsAPI;
    (function(){
      //Create a fake ctxscript variable for testing.
      var cxsAPI = Object.create(originalCxsAPI);
      cxsAPI.$el = $testContainer;
      var scriptResult = eval(
        traceur.Compiler.script(script)
      );
    }());
  });
  
  cxsAPI.$el.find("#save").click(function ( e ) {
    $(e.target).prop('disabled', true);
    $(e.target).text("Saving...");
    cxsAPI.apiPost('/v0/scripts', {
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
  cxsAPI.$el.find("#publish").click(function ( e ) {
    $(e.target).prop('disabled', true);
    $(e.target).text("Publishing...");
    cxsAPI.apiPost('/v0/publish', {
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
    cxsAPI.$el.text('Error: Could not find script with the given id.');
  } else {
    throw err;
  }
});
```