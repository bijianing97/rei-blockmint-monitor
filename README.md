# rei-blockMint-monitor
## Description: A simple block miner for the Rei blockchain

## Environment
You should move `env.example` to `.env` and fill in the environment variables including `data_connection` for database connection and `url` for alarm bot url.

In `src/config/cofig.ts`,you should change the provider url to your own rei node url.

In the `src/tasks/minerMonitor.ts`, we monitor all the miners and record the mined blocks and missed blocks. If you just want to monitor you own miner, you should change it.

## Installation
```bash
npm install
```
## Usage
```bash
npm run start
```
## API
### Structure
#### Block
```json
  {
    blockNumber: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      unique: true,
    },
    hash: {
      type: DataTypes.STRING,
    },
    miner: {
      type: DataTypes.STRING,
    },
    timestamp: {
      type: DataTypes.INTEGER,
    },
  }
```
#### Miner
```json
{
    miner: {
      type: DataTypes.STRING,
      primaryKey: true,
      unique: true,
    },
    minedNumber: {
      type: DataTypes.INTEGER,
    },
    lastBlock: {
      type: DataTypes.INTEGER,
    },
    lastTimeStamp: {
      type: DataTypes.INTEGER,
    },
    reward: {
      type: DataTypes.DECIMAL(65, 0),
    },
  }
```

#### MissRecord
```json
{
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      unique: true,
    },
    blockNumber: {
      type: DataTypes.INTEGER,
    },
    missMiner: {
      type: DataTypes.STRING,
    },
    round: {
      type: DataTypes.INTEGER,
    },
  }
```

### example

#### get miner message
```bash
curl 'http://127.0.0.1:3000/api/miner?miner=0x4e02f5dd4b2cd055b31cb2a62f19b1c57a9c992c'
```

```json
{
   "minerMessage" : {
      "createdAt" : "2022-09-14T03:22:35.309Z",
      "lastBlock" : 7306487,
      "lastTimeStamp" : 1663095061,
      "minedNumber" : 35784,
      "miner" : "0x4e02f5dd4b2cd055b31cb2a62f19b1c57a9c992c",
      "reward" : "34041095890403487383552",
      "updatedAt" : "2022-09-14T05:24:45.124Z"
   },
   "minerMissRecordNumber" : 1399
}
```

#### get mined block message
```bash
 curl'http://127.0.0.1:3000/api/minedblocks?miner=0x7b7bb7c41d3cc9bb967e4fc1a240292a228b4968&offset=10&limit=1' 
 ```

```json
[
   {
      "blockNumber" : 7011552,
      "createdAt" : "2022-09-14T03:22:38.621Z",
      "hash" : "0xcee6836cd2db7fab349dda87fb02b446701a1821343f274387e6fdff8d964ec8",
      "miner" : "0x7b7bb7c41d3cc9bb967e4fc1a240292a228b4968",
      "timestamp" : 1661945917,
      "updatedAt" : "2022-09-14T03:22:38.621Z"
   }
]
```

#### get miss record
```bash
curl 'http://127.0.0.1:3000/api/missrecords?miner=0x39fefe8d70d21e8946dedcd30f4ce874f0aabe1a&offset=1&limit=1'
```

```json
{
   "missRecords" : [
      {
         "blockNumber" : 7014348,
         "createdAt" : "2022-09-14T03:24:22.414Z",
         "id" : "7014348-0x39fefe8d70d21e8946dedcd30f4ce874f0aabe1a-0",
         "missMiner" : "0x39fefe8d70d21e8946dedcd30f4ce874f0aabe1a",
         "round" : 0,
         "updatedAt" : "2022-09-14T03:24:22.414Z"
      }
   ]
}
```

#### get miners reward
```bash
curl 'http://127.0.0.1:3000/api/minersReward'| json_pp
```

```json
[
   {
      "allReward" : "418068441759628073350022",
      "claimedRecords" : [
         {
            "claimValue" : "27995995968766654560798",
            "createdAt" : "2023-05-22T03:34:05.868Z",
            "isClaimed" : true,
            "isUnstaked" : true,
            "startClaimBlock" : 7732013,
            "to" : "0xf06313d8b2acc5c5090ddd9b2f0d7bf66ea4fa85",
            "unstakeBlock" : 7885210,
            "unstakeId" : 418,
            "unstakeValue" : "27995995968766654560798",
            "updatedAt" : "2023-05-22T03:41:52.017Z",
            "validator" : "0xf06313d8b2acc5c5090ddd9b2f0d7bf66ea4fa85"
         },
         {
            "claimValue" : "35390437583207727114061",
            "createdAt" : "2023-05-22T03:55:59.928Z",
            "isClaimed" : true,
            "isUnstaked" : true,
            "startClaimBlock" : 8161356,
            "to" : "0xf06313d8b2acc5c5090ddd9b2f0d7bf66ea4fa85",
            "unstakeBlock" : 8313515,
            "unstakeId" : 457,
            "unstakeValue" : "35390437583207727114061",
            "updatedAt" : "2023-05-22T04:04:13.632Z",
            "validator" : "0xf06313d8b2acc5c5090ddd9b2f0d7bf66ea4fa85"
         },
         {
            "claimValue" : "30969897252240705024228",
            "createdAt" : "2023-05-22T03:15:22.384Z",
            "isClaimed" : true,
            "isUnstaked" : true,
            "startClaimBlock" : 7378616,
            "to" : "0xf06313d8b2acc5c5090ddd9b2f0d7bf66ea4fa85",
            "unstakeBlock" : 7533981,
            "unstakeId" : 383,
            "unstakeValue" : "30969897252240705024228",
            "updatedAt" : "2023-05-22T03:23:08.291Z",
            "validator" : "0xf06313d8b2acc5c5090ddd9b2f0d7bf66ea4fa85"
         },
         {
            "claimValue" : "4000000000000000000000",
            "createdAt" : "2023-05-22T03:24:13.789Z",
            "isClaimed" : true,
            "isUnstaked" : true,
            "startClaimBlock" : 7558887,
            "to" : "0xf06313d8b2acc5c5090ddd9b2f0d7bf66ea4fa85",
            "unstakeBlock" : 7732021,
            "unstakeId" : 409,
            "unstakeValue" : "4000000000000000000000",
            "updatedAt" : "2023-05-22T03:34:05.905Z",
            "validator" : "0xf06313d8b2acc5c5090ddd9b2f0d7bf66ea4fa85"
         },
         {
            "claimValue" : "1461318777398302447809",
            "createdAt" : "2023-05-22T02:56:47.198Z",
            "isClaimed" : true,
            "isUnstaked" : true,
            "startClaimBlock" : 7027863,
            "to" : "0xf06313d8b2acc5c5090ddd9b2f0d7bf66ea4fa85",
            "unstakeBlock" : 7191600,
            "unstakeId" : 325,
            "unstakeValue" : "1461318777398302447809",
            "updatedAt" : "2023-05-22T03:05:13.156Z",
            "validator" : "0xf06313d8b2acc5c5090ddd9b2f0d7bf66ea4fa85"
         },
         {
            "claimValue" : "1144030989630074751558",
            "createdAt" : "2023-05-22T02:57:53.229Z",
            "isClaimed" : true,
            "isUnstaked" : true,
            "startClaimBlock" : 7045576,
            "to" : "0xf06313d8b2acc5c5090ddd9b2f0d7bf66ea4fa85",
            "unstakeBlock" : 7205725,
            "unstakeId" : 338,
            "unstakeValue" : "1144030989630074751558",
            "updatedAt" : "2023-05-22T03:05:54.180Z",
            "validator" : "0xf06313d8b2acc5c5090ddd9b2f0d7bf66ea4fa85"
         },
         {
            "claimValue" : "49734588932612732062378",
            "createdAt" : "2023-05-22T04:28:12.537Z",
            "isClaimed" : true,
            "isUnstaked" : true,
            "startClaimBlock" : 8784608,
            "to" : "0xf06313d8b2acc5c5090ddd9b2f0d7bf66ea4fa85",
            "unstakeBlock" : 8936049,
            "unstakeId" : 504,
            "unstakeValue" : "49734588932612732062378",
            "updatedAt" : "2023-05-22T04:35:56.222Z",
            "validator" : "0xf06313d8b2acc5c5090ddd9b2f0d7bf66ea4fa85"
         },
         {
            "claimValue" : "58217083708436611376891",
            "createdAt" : "2023-05-22T05:06:57.937Z",
            "isClaimed" : true,
            "isUnstaked" : true,
            "startClaimBlock" : 9500852,
            "to" : "0xf06313d8b2acc5c5090ddd9b2f0d7bf66ea4fa85",
            "unstakeBlock" : 9684881,
            "unstakeId" : 586,
            "unstakeValue" : "58217083708436611376891",
            "updatedAt" : "2023-05-22T05:16:00.647Z",
            "validator" : "0xf06313d8b2acc5c5090ddd9b2f0d7bf66ea4fa85"
         },
         {
            "claimValue" : "57929895610161756697533",
            "createdAt" : "2023-05-22T05:43:02.919Z",
            "isClaimed" : true,
            "isUnstaked" : true,
            "startClaimBlock" : 10195405,
            "to" : "0xf06313d8b2acc5c5090ddd9b2f0d7bf66ea4fa85",
            "unstakeBlock" : 10353397,
            "unstakeId" : 613,
            "unstakeValue" : "57929895610161756697533",
            "updatedAt" : "2023-05-22T05:51:06.013Z",
            "validator" : "0xf06313d8b2acc5c5090ddd9b2f0d7bf66ea4fa85"
         },
         {
            "claimValue" : "48337707533480265906259",
            "createdAt" : "2023-05-22T06:14:04.783Z",
            "isClaimed" : true,
            "isUnstaked" : true,
            "startClaimBlock" : 10777911,
            "to" : "0xf06313d8b2acc5c5090ddd9b2f0d7bf66ea4fa85",
            "unstakeBlock" : 10945474,
            "unstakeId" : 638,
            "unstakeValue" : "48337707533480265906259",
            "updatedAt" : "2023-05-22T06:22:49.842Z",
            "validator" : "0xf06313d8b2acc5c5090ddd9b2f0d7bf66ea4fa85"
         },
         {
            "claimValue" : "54288327142061625478099",
            "createdAt" : "2023-05-22T06:51:55.348Z",
            "isClaimed" : true,
            "isUnstaked" : true,
            "startClaimBlock" : 11408362,
            "to" : "0xf06313d8b2acc5c5090ddd9b2f0d7bf66ea4fa85",
            "unstakeBlock" : 11566630,
            "unstakeId" : 670,
            "unstakeValue" : "54288327142061625478099",
            "updatedAt" : "2023-05-22T07:03:23.888Z",
            "validator" : "0xf06313d8b2acc5c5090ddd9b2f0d7bf66ea4fa85"
         }
      ],
      "claimedReward" : "369469283497996455419614",
      "miner" : "0xf06313d8b2acc5c5090ddd9b2f0d7bf66ea4fa85",
      "unclaimedReward" : "48599158261631617930408"
   }]
```