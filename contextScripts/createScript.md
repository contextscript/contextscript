---
q:
  - "Edit script with id {{id}}"
  - "Create a script"
  - "Create a script for this context"
  - "Create a script from this one"
  - "Clone this script"
  - "Edit this script"
  - "Fork this script"

---
```javascript
let ctrlTemplate = (templateContext)=>{
  return `
    <div class="ctxscript-btn-group">
      <button
        id="save"
        class="ctxscript-btn"
      >
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
  `;
}
let template = (templateContext)=>{
  let { edCtxScript, user, baseUrl } = templateContext;
  //TODO: Add last saved date
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
      .resize-context, .resize-script {
        font-size: 12px;
        font-weight: normal;
        color: blue;
        float: right;
      }
    </style>
    <div class="ctxscript-editor">
      <small>
        Editing script:
        <a
          href="${ baseUrl }/contextscripts/${ edCtxScript._id }"
          target="_blank">
          ${ edCtxScript._id }
        </a>
      </small>
      ${ edCtxScript.parentId ?
          `<br /><small>
            This is a fork of:
            <a
              href="${ baseUrl }/contextscripts/${ edCtxScript.parentId }"
              target="_blank">
              ${ edCtxScript.parentId }
            </a>
          </small>`
        : ""
      }
      ${ edCtxScript.lastModified ?
        `<br /><small>
          Last Modified: ${(new Date(edCtxScript.lastModified)).toDateString()}
        </small>`
      : ""
      }
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
      ${ user ?
        ( edCtxScript.published ?
          `<div>
          This script has been published, you cannot save changes to it directly.
          However, you can override the script by creating a fork.
          If the fork is published, it will replace the original.
          <button id="fork" class="ctxscript-btn">Create Fork</button>
          </div>`
          :
          ( (!edCtxScript.savedBy || edCtxScript.savedBy === user.id) ?
            `<div id="controls">${ ctrlTemplate(templateContext) }</div>`
            :
            `<div>
            You must be be the script's creator to save changes to it.
            However, you can override it by creating a fork of it.
            <button id="fork" class="ctxscript-btn">Create Fork</button>
            </div>`
          )
        )
        :
        `<div>You must be signed into a contextscript.com account to save this script.</div>`
      }
    </div>`;
};
// If require is defined on the page it can break ace
// so it is temporairily kept in another variable.
window.pageRequire = window.require;
window.require = undefined;
cxsAPI.$el.text('Loading editor...');
Promise.all([
  System.import('ace/ace'),
  System.import('github:nodeca/js-yaml@master/dist/js-yaml'),
  new Promise((resolve, reject)=>{
    if(!cxsAPI.args.id) return resolve();
    $.get(cxsAPI.config.url + '/v0/contextscripts/' + cxsAPI.args.id)
      .success(resolve)
      .fail((resp)=>reject({reason: "missing", resp: resp}))
  })
]).then(([ace, YAML, myContextScript])=>{
  window.require = window.pageRequire;
  function generateScriptId(){
    return cxsAPI.config.user.id + '-' + Number(new Date());
  }
  //Set some defaults:
  var edCtxScript = {
    context: {
      q:"Write a trigger phrase here..."
    },
    script: 'cxsAPI.$el.text("Hello World!");',
    _id: null
  };
  if(cxsAPI.config.user) {
    edCtxScript._id = generateScriptId();
  }
  var qItemMap = {
    "Edit script with id {{id}}" : ()=>{
      $.extend(edCtxScript, myContextScript._source, true);
      edCtxScript._id = myContextScript._id;
    },
    "Create a script" : ()=>{
      //The defaults are fine. We don't need to do anything.
    },
    "Create a script for this context" : ()=>{
      //It's a bit ambiguous exactly which context "this" refers to.
      //This assumes it refers to the previous script's context
      //rather than the context created by invoking the command.
      let prevHistItem = cxsAPI.getPrevHistItem();
      if(prevHistItem) {
        $.extend(edCtxScript.context, prevHistItem.context, true);
      }
    },
    "Create a script from this one" : ()=>{
      let prevCtxScript = cxsAPI.getPrevEvaledCtxScript();
      if(prevCtxScript) {
        edCtxScript.context = $.extend({}, prevCtxScript._source.context, true);
        edCtxScript.script = prevCtxScript._source.script;
      } else {
        throw new Error("Which one?");
      }
    },
    "Clone this script" : ()=>qItemMap["Create a script from this one"](),
    "Edit this script" : ()=>{
      let prevCtxScript = cxsAPI.getPrevEvaledCtxScript();
      if(prevCtxScript) {
        $.extend(edCtxScript, prevCtxScript._source, true);
        edCtxScript._id = prevCtxScript._id;
      } else {
        throw new Error("Which one?");
      }
    },
    "Fork this script" : ()=>{
      let prevCtxScript = cxsAPI.getPrevEvaledCtxScript();
      if(prevCtxScript) {
        if(!prevCtxScript._source.published && prevCtxScript._source.savedBy === cxsAPI.config.user.id) {
          throw new Error("You cannot fork your own scripts unless they have been published.");
          // Currently, there isn't a mechanism for using other people's
          // unpublished scripts, so checking who saved the script might not
          // be necessary. However, if something like trusted groups which
          // share scripts is implmented, that could change.
        } else {
          edCtxScript.context = $.extend({}, prevCtxScript._source.context, true);
          edCtxScript.script = prevCtxScript._source.script;
          edCtxScript.parentId = prevCtxScript._id;
        }
      } else {
        throw new Error("Which one?");
      }
    }
  };
  if(cxsAPI.qItem in qItemMap) qItemMap[cxsAPI.qItem]();
  
  let render = ()=>{
    cxsAPI.$el.off("click");
    cxsAPI.$el.html(template({
      user: cxsAPI.config.user,
      edCtxScript: edCtxScript,
      baseUrl: cxsAPI.config.url
    }));
    var contextEditor = ace.edit(cxsAPI.$el.find("#context")[0]);
    //TODO: Make highlighting work
    // Related: https://github.com/jspm/registry/issues/38
    //contextEditor.getSession().setMode("ace/mode/yaml");
    contextEditor.renderer.setShowGutter(false);
    contextEditor.setOption("maxLines", 60);
    contextEditor.setOption("minLines", 2);
    contextEditor.setOption("highlightActiveLine", false);
    contextEditor.getSession().setTabSize(2);
    
    contextYAML = YAML.dump({q: edCtxScript.context.q});
    contextYAML +=
    "# If you specify a url href, the script will only be triggered when\n" +
    "# the user is visiting that exact url (including hash and query components).\n";
    if("location" in edCtxScript.context) {
      contextYAML += YAML.dump({location: edCtxScript.context.location});
    } else {
      contextYAML += "# " + YAML.dump({
        location: cxsAPI.context.location || null
      }).replace(/\n/g, "\n# ");
    }
    contextYAML += "\n" +
    "# Setting the prevCtxScriptId makes it so the script can only be triggered\n" +
    "# immediately after the script with the given id has been triggered.\n";
    if("prevCtxScriptId" in edCtxScript.context) {
      contextYAML += YAML.dump({prevCtxScriptId: edCtxScript.context.prevCtxScriptId});
    } else {
      contextYAML += "# " + YAML.dump({
        prevCtxScriptId: cxsAPI.context.prevCtxScriptId || null
      }).replace(/\n/g, "\n# ");
    }
  
    contextEditor.getSession().setValue(contextYAML);
    var scriptEditor = ace.edit(cxsAPI.$el.find("#script")[0]);
    //scriptEditor.getSession().setMode("ace/mode/javascript");
    scriptEditor.renderer.setShowGutter(false);
    scriptEditor.setOption("maxLines", 60);
    scriptEditor.setOption("minLines", 3);
    scriptEditor.setOption("highlightActiveLine", false);
    scriptEditor.getSession().setValue(edCtxScript.script);
    scriptEditor.getSession().setTabSize(2);
  
    cxsAPI.$el.on("click", "#test", (e)=>{
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
    cxsAPI.$el.on("click", "#fork", (e)=>{
      edCtxScript = {
        context: YAML.safeLoad(contextEditor.getSession().getValue()),
        script: scriptEditor.getSession().getValue(),
        parentId: edCtxScript._id,
        _id: generateScriptId()
      };
      render();
    });
    cxsAPI.$el.on("click", "#save", (e)=>{
      $(e.currentTarget).prop('disabled', true);
      $(e.currentTarget).text("Saving...");
      cxsAPI.apiPost('/v0/scripts', $.extend({}, edCtxScript, {
        context: YAML.safeLoad(contextEditor.getSession().getValue()),
        script: scriptEditor.getSession().getValue()
      })).fail((err)=>{
        alert(JSON.stringify(err));
      }).always((resp)=>{
        console.log(resp);
        $(e.currentTarget).prop('disabled', false);
        $(e.currentTarget).text("Save");
      });
    });
    cxsAPI.$el.on("click", "#publish", (e)=>{
      $(e.currentTarget).prop('disabled', true);
      $(e.currentTarget).text("Publishing...");
      cxsAPI.apiPost('/v0/publish', {
        _id: edCtxScript._id
      }).fail(function(err){
        alert(JSON.stringify(err));
      }).always(function(resp){
        console.log(resp);
        $(e.currentTarget).prop('disabled', false);
        $(e.currentTarget).text("Publish");
      });
    });
  };
  render();
})
.catch((err)=>{
  window.require = window.pageRequire;
  if(err.reason == "missing") {
    cxsAPI.$el.text('Error: Could not find script with the given id.');
  } else {
    cxsAPI.$el.text('Error: ' + err.message);
  }
});
```