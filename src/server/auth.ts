import auth from "basic-auth";
import bcrypt from "bcrypt";

const user = {
    name: process.env.BASIC_AUTH_USER ?? 'no_username_provided',
    hashedPassword: process.env.BASIC_AUTH_PASSWORD_HASH ?? 'no_password_hash_provided',
    isAuthEnabled: process.env.BASIC_AUTH_USER !== undefined && process.env.BASIC_AUTH_PASSWORD_HASH !== undefined
};

export default function (req: any, res: any, next: any) {
    // allow /ollama to be accessed without auth
    /* if (req.path.startsWith("/ollama")) {
        next();
        return;
    } */

    if (!user.isAuthEnabled) {
        //if environment variables not set, skip HTTP Auth. NOT RECOMMENDED!
        next()
        return;
    }

    const credentials = auth(req);
    if (!credentials || !credentials.name || !credentials.pass) {
        res.setHeader('WWW-Authenticate', 'Basic realm="example"');
        return res.status(401).send('Access denied');
    }

    if (credentials.name === user.name) {
        bcrypt.compare(credentials.pass, user.hashedPassword, (err, result) => {
            if (result) {
                next();
            } else {
                res.setHeader('WWW-Authenticate', 'Basic realm="example"');
                res.status(401).send('Access denied');
            }
        });
    } else {
        res.setHeader('WWW-Authenticate', 'Basic realm="example"');
        res.status(401).send('Access denied');
    }
};
