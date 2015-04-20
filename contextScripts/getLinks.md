---
q:
  - get links
  - extract links

---
```javascript
cxsAPI.setResult(Array.from(
  document.querySelectorAll('a[href]')
).map((el)=>{
  return {
    text: el.textContent,
    url: el.href
  };
}));
```