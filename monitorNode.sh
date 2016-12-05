RELEASE="test"
LISK_PATH="/home/$USER/lisk-$RELEASE"
LISK_LOG="/home/$USER/lisk-$RELEASE/logs/lisk_$RELEASE.app.log"
LISK_SH="/home/$USER/lisk-$RELEASE/lisk.sh"
LOG_FILE="logs/monitorNode.log"
MINUTES="5"
pkill -f $LISK_LOG -9
nohup bash liskak.sh -S ${LISK_PATH} -J $LISK_LOG -K $LISK_SH -B $MINUTES  > $LOG_FILE 2>&1&
