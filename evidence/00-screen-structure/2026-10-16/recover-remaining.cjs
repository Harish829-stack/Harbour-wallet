const fs=require('fs'),cp=require('child_process');
for(const file of ['buy-mUiKGiqX','sell-DEKcDK89','fiat-ramps-BdoaGdC5','custom-asset-Bpl9EE2o','network-BgRJPftY']){
 const result=cp.spawnSync('/opt/rea/node_modules/.bin/rea',['recover-javascript-sources',`/output/inputs/${file}-routes.js`,`/output/recovered-${file}`,'--format','json'],{encoding:'utf8'});
 fs.writeFileSync(`/output/REA-${file}.json`,result.stdout);if(result.status)throw new Error(result.stderr);
 console.log(file+' recovered');
}
