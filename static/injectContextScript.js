var injectContextScript = function(config, options){
//If ctxscript was previously closed, just reopen the old instance.
var container = document.querySelector('.ctxscript-container');
if(container) {
  if(container.style.display === "none") {
    container.style.display = "";
  } else {
    container.style.display = "none";
  }
  return;
}
//Set defaults
if(!options) options = {};
if(!options.container) {
  options.container = document.createElement('div');
  options.container.className = "ctxscript-container";
}
var link = document.createElement("link");
link.rel="stylesheet";
link.href = config.url + "/ctxscript.css";

options.container.innerHTML = '<div id="ctxscript-out"></div>' +
  '<div class="ctxscript-box" style="margin-bottom: 200px;">' +
  '<input id="ctxscript-q"></input>' +
  '<button class="ctxscript-invoke" disabled=disabled>&gt;</button>' +
  '<button class="ctxscript-settings-btn" disabled=disabled>≡</button>' +
  '<div class="ctxscript-settings" style="display:none;"><p class="ctxscript-close">Close</p></div>' +
  '</div>';
var body = document.getElementsByTagName('body')[0];
body.appendChild(options.container);
//Wait for the the injected css to start styling.
var qBox = options.container.querySelector('#ctxscript-q');
function waitForStyles(){
  window.setTimeout(function(){
    if(qBox.offsetTop < 10) {
      qBox.focus();
    } else {
      waitForStyles();
    }
  }, 900);
}
waitForStyles();

document.body.appendChild(link);
var lst = function(path) {
  return function(){
    return new Promise(function(resolve, reject){
      var s = document.createElement("script");
      if (s.addEventListener) {
        s.addEventListener("load", resolve, false);
      } else if (s.readyState) {
        s.onreadystatechange = resolve;
      }
      s.src = path;
      document.body.appendChild(s);
    });
  };
};
Promise.all([
  lst(config.url + "/main.js")(),
  lst("https://github.jspm.io/jmcriffey/bower-traceur@0.0.79/traceur.js")()
])
.then(lst("https://github.jspm.io/ModuleLoader/es6-module-loader@0.10.0/dist/es6-module-loader.js"))
.then(lst("https://jspm.io/system@0.9.js"))
.then(function(){
  window.initializeCtxScript(config, options);
});
};
