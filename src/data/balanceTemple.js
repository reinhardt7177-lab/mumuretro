export const BALANCE_TEMPLE = {
  model: 'assets/models/balance-temple-v02.glb',
  rooms: [
    {id:'entry',kind:'corridor',w:6,from:18,to:6,h:8,open:true},
    {id:'r1',kind:'room',name:'무게의 회랑',w:14,from:6,to:-12,h:9,gate:'balanceOrder',act:'carry',goal:'3·4·5개 중 고르고, 저울로 비교해 가벼운 순서대로 놓아라.',hints:['입구의 세 표식에서 상자 수를 고를 수 있다.','저울의 두 접시에 올려 비교해라.','왼쪽 받침부터 가장 가벼운 상자를 놓아라.']},
    {id:'c1',kind:'corridor',w:5,from:-12,to:-16,h:8,door:'r1'},
    {id:'r2',kind:'room',name:'두 판의 균형',w:14,from:-16,to:-32,h:9,gate:'twinBalance',act:'carry',goal:'양쪽 판에 두 상자씩 놓아 무게를 같게 만들어라.',hints:['빛의 칸은 올려놓은 무게만큼 찬다.','양쪽에 상자 두 개씩 있어야 문이 열린다.','무거운 상자와 가벼운 상자를 짝지어 보아라.']},
    {id:'c2',kind:'corridor',w:5,from:-32,to:-36,h:8,door:'r2'},
    {id:'shrine',kind:'room',name:'여섯 칸의 지레',w:18,from:-36,to:-64,h:11,act:'carry',goal:'두 추를 여섯 칸에 놓고 지지대를 옮겨 수평을 맞춰라.',hints:['지지대에서 멀어질수록 같은 추도 더 크게 기울인다.','지지대 양쪽에 추를 하나씩 놓아라.','무게와 지지대까지의 거리를 곱해 비교해 보아라.']},
  ],
  gateZ:-54, godZ:-60,
};
