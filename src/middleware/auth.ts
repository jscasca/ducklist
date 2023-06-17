const jwt = require('jsonwebtoken');
const TOKEN_KEY = process.env.TOKEN_KEY || 'token_key';

export const verifyToken = (req: any, res: any, next: any) => {
  const token = req.body.token || req.query.token || req.headers["x-access-token"];
  if (!token) {
    return res.status(401).send('Token required');
  }
  try {
    const decoded = jwt.verify(token, TOKEN_KEY);
    // console.log('veirfied ', JSON.stringify(decoded));
    req.user = decoded;
  } catch (err: any) {
    let message = 'Invalid token';
    if (err.name == 'TokenExpiredError') {
      message = 'Expired token';
    }
    return res.status(401).send(message)
  }
  return next();
}