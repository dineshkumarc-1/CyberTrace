import 'dotenv/config';
import http from 'node:http';
import { pipeline,env } from '@huggingface/transformers';
// Local inference. Initial model download needs internet; later runs use the cache.
env.cacheDir=process.env.MODEL_CACHE||'./.local/models';
const model=process.env.EMBEDDING_MODEL||'Xenova/all-MiniLM-L6-v2';
console.log('Loading model:',model);
const extractor=await pipeline('feature-extraction',model,{dtype:'q8'});
const server=http.createServer(async(req,res)=>{
 res.setHeader('content-type','application/json');
 if(req.method==='GET'&&req.url==='/health'){res.end(JSON.stringify({ok:true,model,dimensions:384}));return;}
 if(req.method!=='POST'||req.url!=='/embed'){res.writeHead(404);res.end('{"error":"Not found"}');return;}
 try{let data='';for await(const part of req){data+=part;if(Buffer.byteLength(data)>1000000){res.writeHead(413);res.end('{"error":"Too large"}');return;}}
 const {texts}=JSON.parse(data);if(!Array.isArray(texts)||!texts.length||texts.length>100||texts.some(t=>typeof t!=='string'||!t.length||t.length>5000)){res.writeHead(400);res.end('{"error":"Invalid texts"}');return;}
 const result=await extractor(texts,{pooling:'mean',normalize:true});res.end(JSON.stringify({model,vectors:result.tolist()}));
 }catch(e){console.error(e.message);res.writeHead(503);res.end('{"error":"Embedding failed"}');}
});
server.listen(Number(process.env.EMBEDDING_PORT||8001),'127.0.0.1',()=>console.log('Embedding service on http://127.0.0.1:8001'));
