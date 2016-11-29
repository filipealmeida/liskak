HOST1=""
HOST2=""
HOST3=""
HOST4=""
CONFIG="src/liskak_mainnet.json"
LOG_FILE="logs/forgingMain.log"
pkill -f $HOST1 -9
nohup bash liskak.sh -c $CONFIG -f $HOST1 $HOST2 $HOST3 $HOST4 > $LOG_FILE 2>&1&
