const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.join(__dirname, '..');
const store = {};
const local = { console, Date, Math, localStorage: { getItem: k => store[k] || null, setItem: (k,v) => store[k] = String(v), removeItem: k => delete store[k] } };
local.window = local;
vm.createContext(local);
vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/data.js'), 'utf8'), local);
const D = local.PNC_DB; D.load();
D.logIn('elena@example.com', 'member123');
assert(D.updatePet('pt-3', { petName: 'unauthorized' }).error);
const originalOwner = D.currentOwner().id;
D.adminLogin('owner@pawsandclaws.example', 'admin123');
const customer = D.createOwner({fullName:'Audit Customer',email:'audit@example.com'}).owner;
assert(customer && !customer.passwordHash);
assert.equal(D.currentOwner().id, originalOwner, 'CRM creation must not switch the member session');
assert(D.createOwner({fullName:'Duplicate',email:'audit@example.com'}).error);
assert(!D.sendMessage(originalOwner,'Care update','Your visit is confirmed.').error);
const message = D.db.messages.at(-1);
assert.equal(message.direction, 'out');
assert(!D.markMessageRead(message.id).error);
assert.equal(message.read,true);
D.db.messages.push({id:'foreign',ownerId:'ow-2',direction:'out',read:false});
assert(D.markMessageRead('foreign').error);
D.adminLogout();
const available = D.SERVICES.flatMap(s => D.slotsFor(D.db,s.id,D.addDays(3)).filter(x=>x.available).map(x=>({...x,serviceId:s.id})))[0];
const occupied = {id:'audit-bk',ownerId:originalOwner,petId:'pt-1',serviceId:available.serviceId,providerId:available.providerId,date:D.addDays(3),hour:available.hour,duration:1,status:'confirmed'};
D.db.bookings.push(occupied);
assert(!D.rescheduleBooking(occupied.id,occupied.date,occupied.hour).error, 'same appointment slot must ignore itself');
D.db.bookings.push({...occupied,id:'occupied',hour:occupied.hour+0.5});
assert(D.rescheduleBooking(occupied.id,occupied.date,occupied.hour+0.5).error, 'overlapping slot must be rejected');
D.adminLogin('rosa@pawsandclaws.example','rosa123');
const other = D.db.bookings.find(b=>b.providerId!=='Rosa');
assert(D.addBookingNote(other.id,'Not my appointment').error);
D.adminLogout();
D.db.payments = [{id:'mine',ownerId:originalOwner,primary:false},{id:'theirs',ownerId:'ow-2',primary:true}];
D.setPrimaryPayment('mine');
assert.equal(D.db.payments.find(p=>p.id==='theirs').primary,true);
assert(D.addPaymentMethod(originalOwner,'Visa','1234',13,2030).error);
console.log('Local member/admin workflow tests passed.');

// Execute the real Convex handlers with a deterministic in-memory database.
// No deployed data or network calls are used.
let who = null;
const tables = {};
let serial = 0;
const db = {
 query(table) {
   let rows = tables[table] ||= [];
   const query = { withIndex(name, fn) { const q = {eq(k,v){rows=rows.filter(r=>r[k]===v);return q;}};fn(q);return query; },
     filter(fn) { const expr = {field:k=>k,eq:(k,v)=>r=>r[k]===v};rows=rows.filter(fn(expr));return query; },
     async collect(){return rows.map(r=>({...r}));}, async first(){return rows[0] || null;} };
   return query;
 },
 async insert(table,row){const id='doc-'+(++serial);(tables[table] ||= []).push({...row,_id:id});return id;},
 async patch(id,patch){assert(id,'patch requires document ID');for(const rows of Object.values(tables)){const row=rows.find(r=>r._id===id);if(row){Object.assign(row,patch);return;}}throw Error('Missing doc');},
 async delete(id){for(const key of Object.keys(tables)) tables[key]=tables[key].filter(r=>r._id!==id);}
};
const backend = {console,crypto,process:{env:{}},mutation:x=>x,query:x=>x,v:{string:()=>({}),any:()=>({})}};
vm.createContext(backend);
let source=fs.readFileSync(path.join(root,'convex/domain.js'),'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export const (\w+) =/g,'globalThis.$1 =');
vm.runInContext(source,backend);
const ctx={db,auth:{getUserIdentity:async()=>who}};
const run=(op,payload={})=>backend.mutate.handler(ctx,{op,payload});
(async()=>{
 await db.insert('listings',{id:'pet-public',status:'available'});
 const anonymous=await backend.bootstrap.handler(ctx);
 assert.equal(anonymous.listings.length,1);
 assert.equal(anonymous.owners.length,0);
 who={subject:'user-new',email:'new@example.com',name:'New Member'};
 await run('ensureOwner');
 assert.equal(tables.owners.length,1);
 assert.equal(tables.owners[0].clerkId,'user-new');
 const owner=tables.owners[0];
 await assert.rejects(run('updateOwner',{ownerId:owner.id,patch:{fullName:''}}),/short/);
 await assert.rejects(run('updateOwner',{ownerId:owner.id,patch:{plan:'senior'}}),/billing/);
 await db.insert('messages',{id:'private',ownerId:'another',direction:'out',read:false});
 await assert.rejects(run('markMessageRead',{messageId:'private'}),/authorized/);
 await assert.rejects(run('createOwner',{input:{fullName:'Test',email:'t@example.com'}}),/authorized/);
 await db.insert('bookings',{id:'b1',ownerId:owner.id,providerId:'Dana',internalNotes:[{note:'staff only'}],status:'confirmed'});
 const member=await backend.bootstrap.handler(ctx);
 assert.equal(member.bookings[0].internalNotes,undefined);
 await db.insert('admins',{id:'staff',clerkId:'staff-user',email:'staff@example.com',role:'super',name:'Admin'});
 who={subject:'staff-user',email:'staff@example.com'};
 await run('createOwner',{input:{fullName:'New Customer',email:'customer@example.com'}});
 await assert.rejects(run('createOwner',{input:{fullName:'Duplicate',email:'customer@example.com'}}),/already/);
 backend.process.env.PNC_PAYMENTS_ENABLED='true';
 await db.insert('products',{id:'product-audit',name:'Test product',price:5,stock:4,lowAt:1});
 await db.insert('pets',{id:'pet-audit',ownerId:owner.id,petName:'Test pet',species:'Dog',vaccines:[]});
 await db.insert('services',{id:'svc-deposit',name:'Deposit service',price:100,duration:1,deposit:true,requiresVaccine:false,staff:['Dana']});
 who={subject:'user-new',email:'new@example.com'};
 await assert.rejects(run('placeOrder',{items:[{id:'product-audit',qty:1}]}),/disabled|not connected/i);
 await assert.rejects(run('createBooking',{petId:'pet-audit',serviceId:'svc-deposit',providerId:'Dana',date:'2026-10-20',hour:9}),/disabled|not connected/i);
 assert.equal(tables.products.find(r=>r.id==='product-audit').stock,4,'unpaid checkout must not reserve inventory');
 assert.equal((tables.bookings||[]).some(r=>r.serviceId==='svc-deposit'),false,'unpaid deposit booking must not reserve a slot');
 who={subject:'staff-user',email:'staff@example.com'};
 const service=await db.insert('services',{id:'svc-audit',name:'Audit service',price:20,duration:1});
 await run('updateService',{serviceId:'svc-audit',patch:{name:'Edited service',price:25,duration:1.5}});
 assert.equal(tables.services.find(r=>r.id==='svc-audit').price,25);
 await assert.rejects(run('updateService',{serviceId:'svc-audit',patch:{duration:13}}),/duration/);
 const contact=await db.insert('contactMessages',{id:'contact-audit',status:'new'});
 await run('setContactStatus',{contactId:'contact-audit',status:'resolved'});
 assert.equal(tables.contactMessages.find(r=>r.id==='contact-audit').status,'resolved');
 await run('sendMessage',{ownerId:owner.id,subject:'Update',body:'Your appointment is ready.'});
 const sent=tables.messages.at(-1);
 assert.equal(sent.channel,'portal');
 who={subject:'user-new',email:'new@example.com'};
 await run('markMessageRead',{messageId:sent.id});
 assert.equal(sent.read,true);
 await db.insert('admins',{id:'provider',clerkId:'provider-user',email:'provider@example.com',role:'provider',providerId:'Rosa',name:'Provider'});
 who={subject:'provider-user',email:'provider@example.com'};
 await assert.rejects(run('addBookingNote',{bookingId:'b1',note:'Forbidden'}),/authorized/);
 await assert.rejects(run('sendMessage',{ownerId:owner.id,subject:'Hello',body:'Forbidden'}),/authorized/);
 console.log('Convex authorization and workflow tests passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
