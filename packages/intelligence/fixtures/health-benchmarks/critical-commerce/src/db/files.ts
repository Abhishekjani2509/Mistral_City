declare const exec: any;
declare const req: any;
export const convertAvatar = () => exec("convert " + req.query.filename);
