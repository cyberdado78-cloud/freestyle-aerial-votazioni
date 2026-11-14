#!/usr/bin/env node
'use strict';
const Licenses=require('./license-service');
const {databaseConfigured,getSupabase}=require('../db');
async function main() {
 const args=process.argv.slice(2),months=Number(args[args.indexOf('--months')+1]);
 if(args.includes('--help')) {console.log('Usage: node scripts/create-license.js --months 3|6|12\nRequires the server-only Supabase credentials. Prints the one-time code; keep it private.');return;}
 if(!Licenses.validMonths(months) || !args.includes('--months'))throw Error('Specify --months 3, 6 or 12.');
 if(!databaseConfigured)throw Error('Server-only Supabase configuration required.');
 const code=Licenses.createCode();
 const {error}=await getSupabase().from('scoreflow_license_codes').insert({code_hash:Licenses.hashCode(code),plan:'professional',duration_months:months,max_activations:1,activation_count:0,active:true});
 if(error)throw Error('License creation failed.');
 console.log(code);
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
