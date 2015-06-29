# Saving and Publishing Context Scripts

Saving a context script will only make it available on your account.
Publishing will make the context script available to everyone. However, 
the script must go through the review queue before it is published.
These are some preliminary guidelines for writing context scripts below.


I haven't created an integrated system for publishing yet. Until then, you can
submit scripts in pull requests to the Context Script github repo [here](https://github.com/contextscript/contextscript/tree/master/contextScripts).

~~If a script is modified after it is published the changes will only be
visible to the author. For modifications to be published the script will
have to go through the review queue again.~~

### Guidelines for writing context scripts

 * No irreversible actions may be performed without prompting the user
   because scripts can be inadvertanly triggered.
   For example, a script that sends emails should let the user know what it will
   do before sending the email, and give them an oppertunity to cancel the action.
   A command like "send this email to X too,"
   which is only intended to add X to the list of recipients for an email,
   could trigger the send email script because it has a similar trigger phrase.
 * Respect the user. 
 * Interact with the context script client through the ctxscript variable.
 * Load external libraries from [jspm](https://jspm.io) via System.import

If you would like to add a guideline, feel free to submit a pull request on this file.
