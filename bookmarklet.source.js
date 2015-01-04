var link = document.createElement("link");
link.rel="stylesheet";
link.href = "https://contextcommand-nathanathan.c9.io/ctxscript.css";
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
var container = document.createElement('div');
container.className = "ctxscript-container";
container.innerHTML = '<div id="ctxscript-out"></div>' +
  '<div class="ctxscript-box">' +
  '<input id="q" size=50></input>' +
  '<button class="ctxscript-invoke" disabled=disabled>&gt;</button>' +
  '</div>';
var body = document.getElementsByTagName('body')[0];
body.appendChild(container);
document.getElementById('q').focus();
lst("https://contextcommand-nathanathan.c9.io/main.js")()
.then(lst("https://github.jspm.io/jmcriffey/bower-traceur@0.0.79/traceur.js"))
.then(lst("https://github.jspm.io/ModuleLoader/es6-module-loader@0.10.0/dist/es6-module-loader.js"))
.then(lst("https://jspm.io/system@0.9.js"))
.then(function(){
  //System.baseURL = 'https://registry.jspm.io';
  window.initializeCtxScript({
    user: 'nathan',
    key: '123',
    url: "https://contextcommand-c9-nathanathan.c9.io"
  });
});
