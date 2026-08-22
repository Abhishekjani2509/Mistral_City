import "./db";

declare const req: any, storedHtml: any[], methodOverride: any, compile: any, redirect: any, user: any, target: any;

document.body.innerHTML = req.query.message;
storedHtml.push(req.body.biography);
methodOverride(req.query._method);
export const pollutedParameters = Object.fromEntries(req.query.entries());
eval(req.body.expression);
export const location = req.headers.host; redirect(location);
compile(req.body.template);
fetch(req.body.url);
Object.assign(user, req.body);
target[req.body.key] = req.body.value;
