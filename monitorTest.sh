HOST1=""
HOST2=""
HOST3=""
HOST4=""
CONFIG="src/liskak_testnet.json"
LOG_FILE="logs/forgingTest.log"
pkill -f $HOST1 -9
nohup bash liskak.sh -c $CONFIG -f $HOST1 $HOST2 $HOST3 $HOST4 > $LOG_FILE 2>&1&
