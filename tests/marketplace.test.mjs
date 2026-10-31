import assert from 'node:assert/strict';
import test from 'node:test';
import { filterMarketplace, marketplaceFiltersFromParams } from '../lib/marketplace.ts';
const filters={search:'',location:'',category:'all',mode:'',sort:'az'};
const fixture=(id,fields={})=>({id,slug:id,display_name:id,business_type:null,description:null,whatsapp:null,address:null,service_area:'Goiânia',service_modes:['domicilio'],logo_url:null,is_published:true,is_preview:false,services:[],...fields});
test('home mostra somente perfis publicados, nunca privados ou previsualizacoes',()=>{
 const publicProfile=fixture('publico');assert.deepEqual(filterMarketplace([publicProfile,fixture('privado',{is_published:false}),fixture('preview',{is_preview:true})],filters).map(p=>p.id),['publico']);
});
test('busca sem acentos encontra nome e servico publicado',()=>{
 const p=fixture('refrigeracao',{display_name:'Refrigeração Exemplo',services:[{id:'s',name:'Manutenção de geladeira',description:null,price:null,is_published:true}]});
 assert.equal(filterMarketplace([p],{...filters,search:'REFRIGERACAO'}).length,1);assert.equal(filterMarketplace([p],{...filters,search:'manutencao'}).length,1);
});
test('categoria usa atividade e servicos publicados sem corresponder a servico privado',()=>{
 const p=fixture('multi',{business_type:'Informática',services:[{id:'p',name:'Barbearia',is_published:false}]});
 assert.equal(filterMarketplace([p],{...filters,category:'beleza'}).length,0);assert.equal(filterMarketplace([p],{...filters,category:'tecnologia'}).length,1);
});
test('regiao e atendimento sao combinados sem prometer cobertura online em qualquer cidade',()=>{
 const a=fixture('go'),b=fixture('sp',{service_area:'São Paulo',service_modes:['online']});
 assert.deepEqual(filterMarketplace([a,b],{...filters,location:'goiania',mode:'domicilio'}).map(p=>p.id),['go']);assert.equal(filterMarketplace([a,b],{...filters,location:'goiania',mode:'online'}).length,0);
});
test('ordenacao nao altera a lista original e suporta nomes Z a A',()=>{
 const data=[fixture('Zeta'),fixture('Alfa')];assert.deepEqual(filterMarketplace(data,filters).map(p=>p.id),['Alfa','Zeta']);assert.deepEqual(data.map(p=>p.id),['Zeta','Alfa']);assert.deepEqual(filterMarketplace(data,{...filters,sort:'za'}).map(p=>p.id),['Zeta','Alfa']);
});
test('querystring preserva filtros e normaliza ordenacao desconhecida',()=>{
 assert.deepEqual(marketplaceFiltersFromParams(new URLSearchParams('buscar=barbeiro&categoria=beleza&localidade=Goi%C3%A2nia&atendimento=presencial&ordem=novo')), {search:'barbeiro',category:'beleza',location:'Goiânia',mode:'presencial',sort:'az'});
});

test('link antigo de todas as localidades e categoria desconhecida mantem catalogo acessivel',()=>{
 const result=marketplaceFiltersFromParams(new URLSearchParams('localidade=todas&categoria=inexistente'));assert.equal(result.location,'');assert.equal(result.category,'all');assert.equal(filterMarketplace([fixture('publico')],result).length,1);
});
