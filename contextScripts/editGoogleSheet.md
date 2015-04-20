---
q: add rows to google sheet {{sheetid}}
---
```javascript
System.import("underscore")
.then((_)=>{
  var sheetId = cxsAPI.args.sheetid;
  var inputData = null;
  if(!sheetId) {
    cxsAPI.$el.html("A sheetid is required");
  }
  function getSheetInfo(){
    cxsAPI
    .apiPost("/v0/googleSheet/info/" + sheetId)
    .then((resp)=>{
      if("oauth2URL" in resp) {
        cxsAPI.$el.one("click", "#auth", ()=>{
          cxsAPI.$el.on("click", ".auth-complete", getSheetInfo);
          return cxsAPI.$el.html(`
            <a class="ctxscript-btn auth-complete">
            Click here when you have completed authentication
            </a>
          `);
        });
        return cxsAPI.$el.html(`
          <a id="auth" href="${resp.oauth2URL}" target="_blank">
          Click here to authenticate with Google
          </a>
        `);
      }
      let info = resp.info;
      let inputCols = _.uniq(_.flatten(_.map(inputData, _.keys)));
      let inHeaderMap = _.object(_.map(info.header, (wsHeader, cNum)=>{
        return [
          _.max(inputCols, (inputHeader)=>{
            return inputHeader == wsHeader;
          }),
          {idx: parseInt(cNum, 10) - 1, header:wsHeader}
        ];
      }));
      //console.log("inHeaderMap", inHeaderMap);
      cxsAPI.$el.html(`
        <p>Worksheet: ${info.worksheetTitle}</p>
        <ul>
        ${
          _.map(inHeaderMap, (val, key)=>{
            return `<li>
              <b>${key}</b> maps to column <b>${val.header}</b>
            </li>`;
          }).join(" ")
        }
        </ul>
        <div class="table-container"></div>
        <button
          class="ctxscript-btn add-rows"
          style="display:block;width: 100%;text-align: left;"
          >Add Rows to spreadsheet</button>
        <a class="ctxscript-btn"
          target="_blank"
          href="https://docs.google.com/spreadsheets/d/${sheetId}/edit"
          >
        Open spreadsheet
        </a>
      `);
      Promise.all([
        System.import("github:handsontable/handsontable@0.14.1/dist/handsontable.full.min"),
        System.import("github:handsontable/handsontable@0.14.1/dist/handsontable.css!")
      ])
      .then(([notHandsontable, noop])=>{
        //The Handsontable  constructor is loaded into the global namespace.
        //I'm not sure what the object SystemJS returns is.
        var container = cxsAPI.$el.find(".table-container")[0];
        let data = [_.values(info.header)]
        .concat(inputData.map((row)=>{
          var rowArray = [];
          _.each(row, (val, header)=>{
            rowArray[inHeaderMap[header].idx] = val;
          });
          return rowArray;
        }));
        var htable = new Handsontable(container, {
          data: data,
          minSpareRows: 1
        });
        cxsAPI.$el.one("click", ".add-rows", (evt)=>{
          htable.updateSettings({readOnly:true});
          $(evt.target).attr('disabled','disabled');
          cxsAPI
          .apiPost("/v0/googleSheet/addRows/" + sheetId,
          {
            rows: data.slice(1).map((row)=>{
              return _.object(row.map((val, idx)=>[idx, val]));
            })
          })
          .then((resp)=>{
            if("oauth2URL" in resp) {
              return $(evt.target).text("Google authentication expired.");
            }
            $(evt.target).text("Rows added!");
          })
          .fail((resp)=>{
            $(evt.target).text("Error");
            console.log(resp);
          });
        });
      });
    })
    .fail((resp)=>{
      console.log(resp);
      if(resp.responseJSON.error === "Error Reading Spreadsheet") {
        return cxsAPI.$el.html(`
          <h3>Could not access spreadsheet</h3>
          Perhaps you are using an invalid id.
        `);
      }
      if(resp.status === 401) {
        cxsAPI.$el.html(`
          <h3>Could not authenticate</h3>
          This script requires a bookmarklet that is linked to a Context Script
          account.
          <a id="auth" href="${config.url + "/login"}">
          Sign in here
          </a>
          to update your bookmarklet.
        `);
      } else {
        cxsAPI.$el.html(`
          <h3>Unknown error:</h3>
          ${resp.responseText}
        `);
      }
    })
  };
  cxsAPI.$el.html("The previous script has not provided any data to upload...");
  cxsAPI.getPrevResultPromise()
  .then((prevResult)=>{
    cxsAPI.$el.html("");
    if(!_.isArray(prevResult)) {
      cxsAPI.$el.html("The data from the previous command is not in a supported format.");
    } else {
      inputData = prevResult;
      getSheetInfo();
    }
  });
});
//Preload handsontable
System.import("github:handsontable/handsontable@0.14.1/dist/handsontable.full.min");
System.import("github:handsontable/handsontable@0.14.1/dist/handsontable.css!");
```