---
q:
    - has this been posted on reddit?
    - has this been posted on hacker news?
---
```javascript
var url = encodeURIComponent(window.location.href),
    title = encodeURIComponent(document.title);

$.ajax({url: '//www.reddit.com/api/info/.json?url=' + url})
.done(function(data) {
    if (data.data.children.length) {
        cxsAPI.$el.append("<a href='http://www.reddit.com/submit?url=" + url + ">Submit to Reddit</a>");
    } else {
        cxsAPI.$el.append("This has been posted to Reddit");
    }
})
.fail(function() { cxsAPI.$el.append("There was an error connecting to Reddit"); });

$.ajax({url: '//hn.algolia.com/api/v1/search?tags=story&restrictSearchableAttributes=url&query=' + url})
.done(function(data) {
    if (data.hits.length) {
        cxsAPI.$el.append("<a href='http://news.ycombinator.com/submitlink?u=" + url + "&t=" + title + ">Submit to Hacker News</a>");
    } else {
        cxsAPI.$el.append("This has been posted to Hacker News");
    }
})
.fail(function() { cxsAPI.$el.append("There was an error connecting to Hacker News"); });
```
