export type Centre = { id:number; name:string; area:string; city:string; distance:number; verified:boolean; updated:string; phone:string; stock:Record<string,number>; slots:string[]; };
export const centres: Centre[] = [
 {id:1,name:'CityCare Blood Centre',area:'Sector 18',city:'Noida',distance:3.2,verified:true,updated:'Today, 10:20 AM',phone:'+91 120 456 7890',stock:{'A+':12,'A-':3,'B+':8,'B-':2,'O+':15,'O-':1,'AB+':4,'AB-':1},slots:['10:30 AM','12:00 PM','2:30 PM','4:00 PM']},
 {id:2,name:'District Hospital Blood Bank',area:'Surajpur',city:'Greater Noida',distance:8.6,verified:true,updated:'Today, 9:45 AM',phone:'+91 120 234 5678',stock:{'A+':5,'A-':1,'B+':11,'B-':0,'O+':7,'O-':2,'AB+':2,'AB-':0},slots:['11:00 AM','1:00 PM','3:30 PM']},
 {id:3,name:'Helping Hands Donation Centre',area:'Indirapuram',city:'Ghaziabad',distance:12.4,verified:false,updated:'Yesterday, 5:10 PM',phone:'+91 120 876 5432',stock:{'A+':2,'A-':0,'B+':4,'B-':1,'O+':6,'O-':0,'AB+':1,'AB-':0},slots:['9:30 AM','12:30 PM']},
 {id:4,name:'Metro Life Blood Services',area:'Sector 62',city:'Noida',distance:5.1,verified:true,updated:'Today, 11:05 AM',phone:'+91 120 111 2222',stock:{'A+':8,'A-':2,'B+':6,'B-':1,'O+':10,'O-':2,'AB+':3,'AB-':1},slots:['10:00 AM','1:30 PM','5:00 PM']}
];
export const bloodGroups=['All groups','A+','A-','B+','B-','O+','O-','AB+','AB-'];
