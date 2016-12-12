# liskak
Lisk Army Knife - Forging failover and command line lisk

:warning: <br />
After configuration, the following examples perform a donation to the address **8858064098621060602L** (hmachado):<br />

```./liskak.sh -s 10``` *# sends 10 LSK to 8858064098621060602L*<br />
```./liskak.sh -t 10 8858064098621060602L``` *# transfers 10 LSK to 8858064098621060602L*<br />

Thank you all and go Lisk go!

![LiskAK proposed setup for monitoring](https://github.com/filipealmeida/liskak/blob/master/docs/liskak_proposed_setup.jpg)

# Foreword
Last weekend, while educating a couple of individuals on javascript, they started asking a lot of questions on how to achieve many things in nodejs.

They wanted to have their lisk delegate nodes monitored, healthy and having at least one forging.<br />
...And then to check their balance<br />
...And then to transfer lisks from the command line<br />
...And then to check sync status<br />
...And then to list their votes<br />
...And then to vote for many delegates.<br />
...And then a lot of other stuff.<br />
<br />
The following script insued.

# DISCLAIMER
This script is immature and in need of many tests.

Nonetheless, since it proved it's worth and is allegedly usefull for the lisk community, here it is.

Pay close attention to the USAGE below, there are some flags that are self explanatory but not detailed in this README file.

Should you want features: ask! Will add it whenever I can.

Do as you will, have a delegation!

# Installing Lisk Army Knife
You'll need to have node version above v4.0.0 on the path.

To install node 4.x on Ubuntu:

```
curl -sL https://deb.nodesource.com/setup_4.x | sudo -E bash -
sudo apt-get install -y nodejs
```

Then, download the master from github and:

1. unzip liskak-master.zip
2. # Configure the file liskak.json in the liskak-master/src folder to reflect your account
3. cd liskak-master
4. npm install
5. ./liskak.sh --help

## Windows
1. Use the nodejs installer to install NODE + NPM
2. # Configure the file liskak.json in the liskak-master/src folder to reflect your account
3. npm install
4. liskak.bat --help

You can always run issuing "node src/liskak.js ARGS"

# Available options:
```
someuser@foo:~/liskak$ ./liskak.sh --help
USAGE: node liskak.js [OPTION1] [OPTION2]... arg1 arg2...
The following options are supported:
  -c, --configuration <ARG1>            	Path to the configuration json file (defaults to ./liskak.json)
  -i, --info                            	Displays your account info
  -N, --newAccount                      	Creates a new account
  -b, --balance <ARG1>                  	Displays an account's balance
  -d, --getHeight                       	Get block height
  -L, --logLevel <ARG1>                 	Logging level, one of: error, warn, info verbose, debug, silly ("info" by default)
  -l, --listVotes <ARG1>                	Lists your votes
  -I, --upvote <ARG1>                   	Vote for delegates in file specified
  -O, --downvote <ARG1>                 	Remove vote from delegates in file specified
  -C, --checkVotes                      	Checks current votes, compares with upvote/downvote data in files (flags -I and -O)
  -R, --replaceVotes                    	Set the upvotes exactly as provided by the upvote list from -I flag
  -A, --commitVotes                     	Executes your voting orders with upvote/downvote data in files (flags -I and -O); check first with -C flag for action list
  -v, --voteForIrondizzy                	Allow a spare voting slot to go to "hmachado"
  -y, --isForging                       	Test if forging
  -Y, --enableForging                   	Enable forging
  -W, --disableForging                  	Disable forging
  -z, --status                          	Reports on sync status of node
  -s, --donate <ARG1>                   	Donate LSK to this great cause, default: 5
  -t, --transfer <ARG1> <ARG2>          	Transfer LSK to an address from your configured account: -t LSK ADDRESS
  -T, --lsktransfer <ARG1> <ARG2>       	Transfer LSK^-8 to an address from your configured account: -T LSK ADDRESS
  -m, --multitransfer <ARG1>...<ARGN>   	Transfer LSK to a list of addresses from your configured account: -t LSK ADDRESS [ADDRESS] ...
  -M, --multilsktransfer <ARG1>...<ARGN>	Transfer LSK^-8 to a list of addresses from your configured account: -t LSK ADDRESS [ADDRESS] ...
  -f, --failoverMonkey <ARG1>...<ARGN>  	Provide a list of available nodes for forging failover; stays awake and acts on blockchain and connection failures
  -Z, --measureOnSyncOnly               	Takes measures of consensus only while syncing
  -S, --supervise <ARG1>                	Provide lisk path to manage lisk process locally (handles fork3, etc.)
  -K, --liskscript <ARG1>               	Provide absolute path for lisk script: lisk.sh for operations (supervise implied)
  -J, --logfile <ARG1>                  	Provide absolute path for lisk logfile (supervise implied)
  -B, --minutesWithoutBlock <ARG1>      	Minutes without blocks before issuing a rebuild, default is disabled (0)
  -Q, --consensus <ARG1> <ARG2>         	Broadhash consensus threshold (%), reload if under value for N consecutive samples ("0,10" by default)
  -q, --inadequateBroadhash             	Restart on "Inadequate broadhash consensus" message
  -P, --pollingInterval <ARG1>          	Interval between node polling in milliseconds ("10000" by default)
  -w, --apiRequestTimeout <ARG1>        	API request timeout, 0 means disabled
  -F, --maxFailures <ARG1>              	Maximum failures tolerated when chatting with lisk nodes ("10" by default)
  -D, --maxBlocksDelayed <ARG1>         	Maximum number of block difference between nodes before change forging node ("3" by default)

```

# Usage examples

### Failover forging and node monitoring
LiskAK running with the failoverMonkey flag will always try to have forging enabled at the best possible node according to the criteria below:

1. If consecutive API call failures are more than maxFailures (-F), force switch
2. If difference to best node more than maxBlocksDelayed (-D), score badly, increased probability of switching to other node
3. If node consensus (flag: -Q) under consensusMinPercent for consensusSampleNum samples, score badly, increased probability of switching to other node
4. If more than one node forging, leave only the best one forging (based on blockheight and consensus percentange)
5. If no nodes forging, select best one and enable forge (based on blockheight and consensus percentange)

***NOTE #0:*** This is EXPERIMENTAL code and it was already nimble enough, if you run into trouble, checkout 82ef27cb3f803693b466938852071dafb117fabc
***NOTE #1:*** In failover mode, -Z flag will measure consensus for -Q flag only when node is syncing (versus all the time from status API call) 
***NOTE #2:*** Consensus will show NaN if the number of samples with -Q hasn't been reached yet 



Example:

```
someuser@foo:~/liskak$ ./liskak.sh -f https://NODE1:8001 https://NODE2:8001 -P 5000 -w 5000 -Q 50 6 -Z
2016-05-28T11:27:03.731Z INFO Failover monkey starting: ["https://NODE1:8001","https://NODE2:8001"]
2016-05-28T11:27:03.737Z INFO Enabling monitor for node https://NODE1:8001
2016-05-28T11:27:03.750Z INFO Enabling monitor for node https://NODE2:8001
2016-05-28T11:27:41.449Z INFO Probe cycle 0
2016-05-28T11:27:41.497Z INFO Evaluation cycle 0
2016-05-28T11:27:51.553Z INFO Probe cycle 1
2016-05-28T11:27:51.557Z INFO Evaluation cycle 1
2016-05-28T11:27:51.558Z INFO https://node1:8001/ has forging ENABLED
2016-05-28T11:27:51.558Z INFO https://node1:8001/ has forging DISABLED
......
```

Additional usage of this can be found in the bundled scripts, `monitorMain.sh` and `monitorTest.sh`. These files include everything needed to enable forging monitoring.

Each script has an associated config file, `liskak_testnet.json` and `liskak_mainnet.json` in the `src/` folder. Simply add the delegate secret you wish you monitor to that file.
Then edit the monitoring script for the network you will be monitoring and include your hosts.

Example:

```
HOST1="http://127.0.0.1:8000"
HOST2=""
HOST3=""
HOST4=
CONFIG="src/liskak_mainnet.json"
LOG_FILE="logs/forgingMain.log"
pkill -f $CONFIG -9
nohup bash liskak.sh -c $CONFIG -f $HOST1 $HOST2 $HOST3 $HOST4 > $LOG_FILE 2>&1&
```

Using mainnet as an example, the script using `bash monitorMain.sh`. The logs for this will be found in `logs/`, this can be watched to see the monitoring in action.

### Supervision of node and automatic restarts/reloads
1. Fork 1: issues rebuild but requires work to do this only if you forged the last block (please open an issue with loglines such as this so it can be corrected)
2. Fork 2: issues a lisk restart
3. Fork 3: issues a rebuild 
4. If "-B <MINUTES>" flag set, rebuild is issued if no blocks occur in <MINUTES>

Please advise for further rules by opening an issue.

Example #1: Lisk 0.3.1 and below, assumes app.log and lisk.sh under the folder provided

```
someuser@foo:~/liskak$ ./liskak.sh -S /opt/lisk
2016-06-03T17:09:37.562Z INFO Initializing
2016-06-03T17:09:37.593Z INFO Looking at the lisk log file "/opt/lisk/app.log"
2016-06-03T17:09:37.594Z INFO Lisk shell script found: /opt/lisk/lisk.sh
2016-06-03T17:09:37.631Z INFO Tailing /opt/lisk/app.log
2016-06-03T17:11:45.103Z ERROR Node has forked with cause: 3, issuing rebuild
2016-06-03T17:11:45.109Z WARN Performing "bash lisk.sh rebuild"
```

Example #2: If you have lisk.sh and or app.log on other locations, use the following flavour

```
someuser@foo:~/liskak$ ./liskak.sh -J /path/to/app.log -K /path/to/lisk.sh
2016-06-03T17:09:37.562Z INFO Initializing
2016-06-03T17:09:37.593Z INFO Looking at the lisk log file "/opt/lisk/app.log"
2016-06-03T17:09:37.594Z INFO Lisk shell script found: /opt/lisk/lisk.sh
2016-06-03T17:09:37.631Z INFO Tailing /opt/lisk/app.log
2016-06-03T17:11:45.103Z ERROR Node has forked with cause: 3, issuing rebuild
2016-06-03T17:11:45.109Z WARN Performing "bash lisk.sh rebuild"
```

WARNING: this surelly won't work in windows; please donate to buy a copy :)

Example #3:

Additional usage of supervise is included in a bundled script `monitorNode.sh`. This script will automatically monitor your node and rebuild after 5 minutes using the default settings for lisk. In order to be used on mainnet the script will need to be modified. Please note that this script assumes lisk installation defaults, if your lisk installation is not default you will also need to modify those parameters.


```
RELEASE="test" <-- This needs to read main instead of test.
LISK_LOG="/home/$USER/lisk-$RELEASE/logs/lisk_$RELEASE.app.log"
LISK_SH="/home/$USER/lisk-$RELEASE/lisk.sh"
LOG_FILE="logs/monitorNode.log"
MINUTES="5"
CONFIG="src/liskak_testnet.json" <-- This should read mainnet instead of testnet
pkill -f $LISK_LOG -9
nohup bash liskak.sh -c $CONFIG -J $LISK_LOG -K $LISK_SH -B $MINUTES  > $LOG_FILE 2>&1&
```

### New account
If executed with the -N flag, Lisk Army Knife will produce a new key for you which you can use as an account.

Store it or add it to your liskak.json file to keep it.

If this flag is set, all other flags will use it.

```
someuser@foo:~/liskak$ ./liskak.sh -N
New account passphrase is: "you spike license country refuse barely turkey session online siege page broken"
xprivate: "xprv9s21ZrQH143K3zFueQ4cz5FwotnficAWw52YTmDxXTFLvH4aikwuRyAmyrZgrLvvguD3dZLroUBt7AzsM9RdPNftUdTnxgCWD5hjJzZbBdm"
```

### Balance and information
After creating your new account, produce a liskak.json file either on the src dir replacing it's contents or writing to a new file, like ~/liskak_new.json

It's contents will be:
```
{
  "secret": "you spike license country refuse barely turkey session online siege page broken",
  "host":"localhost",
  "port":8001,
  "proto": "https"
}
```

Now let's use the new file
```
someuser@foo:~/liskak$ ./liskak.sh -c ~/liskak_new.json -i
2016-05-28T13:40:26.633Z INFO Initializing
Lisk account info for /home/someuser/liskak/liskak_new.json
   address = 1985049510400127319L
   unconfirmedBalance = 0
   balance = 0
   publicKey = 6625586ab0aeed824b83e9e1eff64694367eb51f80173852f13a10133c0aa985
   unconfirmedSignature = 0
   secondSignature = 0
   secondPublicKey = null
   multisignatures = null
   u_multisignatures = null

```
We're using the default from now on, so keep in mind it's the liskak.json file under the src folder "liskak-master/src/liskak.json"

### Transfering funds
If you have balance, you can transfer funds.

Transfering 1 LSK to an account, both commands below are the same:
```
someuser@foo:~/liskak$ ./liskak.sh -t 1 18217073061291465384L
2016-05-28T18:25:36.223Z INFO Initializing
Transfering 1 LSKs to 18217073061291465384L
2016-05-28T18:25:36.498Z INFO Issuing transfer
   transactionId = 3519123441717401234


someuser@foo:~/liskak$ ./liskak.sh -T 100000000 18217073061291465384L
2016-05-28T18:25:36.223Z INFO Initializing
Transfering 1 LSKs to 18217073061291465384L
2016-05-28T18:25:36.498Z INFO Issuing transfer
   transactionId = 3519123441717401234
```

### Forging

Pretty much intuitive:
#### Check status
```
someuser@foo:~/liskak$ ./liskak.sh -y
2016-05-28T15:46:43.919Z INFO Initializing
Forging ENABLED
```

#### Enable
```
someuser@foo:~/liskak$ ./liskak.sh -W
2016-05-28T15:48:48.650Z INFO Initializing
   address = 81237192873981739812L
```

#### Disable
```
someuser@foo:~/liskak$ ./liskak.sh -Y
2016-05-28T15:48:52.171Z INFO Initializing
   address = 81237192873981739812L
```

#### In case of error:
You'll see something like this:
```
someuser@foo:~/liskak$ ./liskak.sh -Y
2016-05-28T15:48:45.382Z INFO Initializing
2016-05-28T15:48:45.913Z ERROR Could not get handle the response:{"success":false,"error":"Forging is already enabled"}
```

### Voting
You can compare your votes to your lists
#### List your issued votes
```
someuser@foo:~/liskak$ ./liskak.sh -l
2016-05-28T15:05:37.961Z INFO Initializing
2016-05-28T15:05:38.438Z INFO Issuing listDelegates
LiskAddress;DelegateName
16979702222780220012L;some
26951091333643074042L;delegate
92873422225441394187L;otehr
75395111111117926082L;hodor
...

```
#### Compare your votes with textfiles with upvotes/downvotes
Now you want to add some (upvotes) to your list or remove some (downvotes)
Produce a couple of text files (none required, but both possible)
1. One with the usernames or addresses (one per line) of the delegates you want to upvote, let's call it "in.txt".
2. Other with the usernames or addresses (one per line) of the delegates you want to downvote, "out.txt". 

Now run the command:
```
someuser@foo:~/liskak$ ./liskak.sh -l -C -I in.txt -O out.txt
2016-05-28T15:13:46.118Z INFO Initializing
2016-05-28T15:13:46.598Z INFO Issuing listDelegates
2016-05-28T15:13:47.199Z INFO Loading 565 delegates in memory.
2016-05-28T15:13:47.200Z INFO Issuing listDelegates
2016-05-28T15:13:47.201Z INFO Issuing listDelegates
2016-05-28T15:13:47.202Z INFO Issuing listDelegates
2016-05-28T15:13:47.203Z INFO Issuing listDelegates
2016-05-28T15:13:47.205Z INFO Issuing listDelegates
2016-05-28T15:13:47.207Z INFO Issuing listDelegates
some already has your vote.
delegate already has your vote.
hodor already has your vote.
You have voted in 101 of 101
You will downvote 2
You will upvote 0
You may still vote in 2 delegates after this
You will have 99 of 101 votes from your account
```
The output is pretty intuitive, it'll list your votes and then report on your files, tell you how many votes you have now, how many, etc.

#### Commit your votes with textfiles with upvotes/downvotes

Just add the -A flag:
```
someuser@foo:~/liskak$ ./liskak.sh -vl -C -I in.txt -O out.txt -A
2016-05-28T15:17:46.118Z INFO Initializing
2016-05-28T15:17:46.292Z INFO Issuing listDelegates
2016-05-28T15:17:46.344Z INFO Loading 565 delegates in memory.
2016-05-28T15:17:46.398Z INFO Issuing listDelegates
2016-05-28T15:17:47.401Z INFO Issuing listDelegates
2016-05-28T15:17:47.402Z INFO Issuing listDelegates
2016-05-28T15:17:47.403Z INFO Issuing listDelegates
2016-05-28T15:17:47.405Z INFO Issuing listDelegates
2016-05-28T15:17:47.407Z INFO Issuing listDelegates
some already has your vote.
delegate already has your vote.
hodor already has your vote.
other will be upvoted.
2016-05-28T15:17:52.125Z WARN 1iiii6979707772780220012L is not a valid delegate
...
2016-05-28T15:17:52.562Z INFO {"success":true,"transaction":{"type":3,"amount":0,"senderPublicKey": ....
```

Please notice, LISK api aparently doesn't support downvoting+upvoting in the same requests.

Should the response indicate insucess, first downvote with the "-O FILE -A" flags and then upvote with the "-I FILE -A" flags.
