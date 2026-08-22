declare const db: any;
declare const req: any;
export const findUser = () => db.query(`SELECT * FROM users WHERE name = '${req.query.name}'`);
export const allUsers = () => db.query("SELECT * FROM users");
