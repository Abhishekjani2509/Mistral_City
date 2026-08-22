export const renderMessage = (req: any) => { document.body.innerHTML = req.query.message; };
export const calculate = (req: any) => eval(req.body.expression);
export const proxy = (req: any) => fetch(req.body.url);
export const updateUser = (user: any, req: any) => Object.assign(user, req.body);
