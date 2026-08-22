declare const app: any;
declare const noAuth: any;
app.get("/admin", noAuth);
export const promote = (user: any, req: any) => { user.role = req.body.role; return user; };
