declare const db: any, req: any, exec: any;

db.query(`SELECT * FROM users WHERE name = '${req.query.name}'`);
exec("convert " + req.query.filename);
