Context Script Specification
------------------------------

The document describes the components of a Context Script in detail.

## The Context

The context is a YAML document that specifies the circumstances the script
should run under. Currently, the only required property is a "q" parameter
that specifies queries or commands used to invoke the script.

By using the syntax from the following example, queries and commands can include
wildcard variables which are passed to the script:

```yaml
q: "send a message to {{name}}"
```

The "q" parameter can include multiple query phrases in an array.

```yaml
q:
  - "What is the date?"
  - "When am I?"
```

Specifying a host name makes it so the command can only be triggered on a
certain website.

```yaml
q: "Search revisions"
location:
  host: https://en.wikipedia.org/
```

Setting the prevCtxScriptId makes it so the script can only be triggered
immediately after the script with the given id has been triggered.

```yaml
q: "save it as a csv"
prevCtxScriptId: "123"
```

## The Script

Broadly, the script is a program that runs whenever the situation described by
the context occurs. Currently, the script is ES6 JavaScript with full access to the DOM.

### The JavaScript API

A variable called `cxsAPI` is provides a number of important features to the script.

#### cxsAPI.$el

A jQuery object referencing a container element for the script's output.

#### cxsAPI.args

Variables from the script's trigger phrase are made available in the args object.

#### cxsAPI.import(jspmScriptName)

Imports the given module from the [jspm](http://jspm.io/) registry
then return it in a promise. Similar to the jspm System.import function.

#### cxsAPI.setResult(data)

Scripts can store a result to be used by future scripts.
This makes is possible to create sequences of commands like:

1. Find all the chemicals mentioned on this page
2. Sort them alphabetically

The result is also printed in the container UI element if the container is not emptied.

#### cxsAPI.getPrevResultPromise()

This will return a result from the previous command in a promise.
