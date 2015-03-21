---
q:
    - extract tables
    - save the data on this webpage as csv
    - save tables as csvs
---
```javascript
System.import("npm:json2csv")
.then((json2csv)=>{
    return Promise.all($('table').toArray().map((table)=>{
        var $rows = $(table).find('tr');
        
        var rowMetadataArray = $rows.toArray()
        .map((row)=>{
            var tds = Array.from(
                row.querySelectorAll("td")
            );
            var ths = Array.from(
                row.querySelectorAll("th")
            );
            return {
                tds: tds.length,
                ths: ths.length,
                columns: tds.length + ths.length
            };
        });
        
        var averages = rowMetadataArray.reduce((sofar, rowMeta)=>{
            sofar.tds += rowMeta.tds;
            sofar.ths += rowMeta.ths;
            sofar.columns += rowMeta.columns;
            return sofar;
        }, {tds: 0, ths: 0, columns: 0});
        averages.tds /= rowMetadataArray.length;
        averages.ths /= rowMetadataArray.length;
        averages.columns /= rowMetadataArray.length;
        console.log(rowMetadataArray, averages);
        var headerIdx = 0;
        while(headerIdx < rowMetadataArray.length){
            let rowMeta = rowMetadataArray[headerIdx];
            if(rowMeta.ths >= averages.ths && rowMeta.columns >= averages.columns) {
                break;
            }
            headerIdx++;
        }
        if(headerIdx === rowMetadataArray.length) {
            return new Promise((resolve)=>{resolve(["Could not find header"]);});
        }
        
        var headerArray = Array.from(
            $rows[headerIdx].querySelectorAll("tr, th")
        )
        .map((header)=>{
            return header.innerText;
        });
        
        var headerStats = headerArray.reduce((sofar, header)=>{
            var cleanHeader = header.trim();
            if(cleanHeader === "") sofar.empty++;
            if(cleanHeader.length > 50) sofar.long++;
            return sofar;
        }, {empty:0, long:0});
        headerStats.empty /= headerArray.length;
        headerStats.long /= headerArray.length;
        
        if(headerStats.empty * 5 + headerStats.long * 4 >= 1.0) {
            return new Promise((resolve)=>{resolve(["Appears to be a formatting table rather than a data table."]);});
        }
        
        var rowObjectArray = $rows.toArray()
        .slice(headerIdx+1)
        .map((row)=>{
            var rowObject = {};
            Array.from(
                row.querySelectorAll("td, th")
            ).forEach((el, idx)=>{
                rowObject[headerArray[idx]] = el.innerText;
            })
            return rowObject;
        });
        
        return new Promise((resolve, reject)=> {
            json2csv({
                data: rowObjectArray,
                fields: headerArray
                },
                (err, result)=> {
                    if(!err) {
                        if(rowObjectArray.length <= 1) {
                            err = "Too few rows, probably a formatting table.";
                        }
                        if(headerArray.length <= 1) {
                            err = "Too few headers, probably a formatting table.";
                        }
                    }
                    return resolve([null, result, rowObjectArray, headerArray]);
                }
            )
        });
    }));
})
.then((results)=>{
    if(results.length === 0) {
        return cxsAPI.$el.html("<h3>No tables found</h3>");
    }
    cxsAPI.setResult(results.map(([error, csvData, data, fields])=>{
        return {
            error: error,
            fields: fields,
            data: data
        };
    }));
    let filteredResults = results.filter(([error, csvData, data, fields])=>{
        if(error) {
            console.log(error);
            return false;
        }
        return true;
    });
    if(filteredResults.length === 0) {
        return cxsAPI.$el.text("No tables found");
    }
    cxsAPI.$el.html(
    filteredResults.map(([error, csvData, data, fields])=>{
        return `
            <h3>Found table with headers:</h3>
            <ul>
                ${fields.map((header)=>`<li>${header}</li>`).join('')}
            </ul>
            <a
                class="ctxscript-btn"
                download="data.csv"
                href="data:application/csv;charset=utf-8,${encodeURIComponent(csvData)}"
            >
                Download
            </a>
        `;
    }).join('<br>'));
})
.catch((err)=>{
    cxsAPI.$el.text(err);
    console.log(err.getStack());
});
```