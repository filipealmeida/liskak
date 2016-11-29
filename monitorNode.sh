RELEASE="test"
LISK_LOG="/home/$USER/lisk-$RELEASE/logs/lisk_$RELEASE.app.log"
LISK_SH="/home/$USER/lisk-$RELEASE/lisk.sh"
LOG_FILE="logs/monitorNode.log"
MINUTES="5"
CONFIG="src/liskak_testnet.json"
pkill -f $LISK_LOG -9
nohup bash liskak.sh -c $CONFIG -J $LISK_LOG -K $LISK_SH -B $MINUTES  > $LOG_FILE 2>&1&
