#!/usr/bin/env sh

SOURCES="\
 https://downloads.lisk.io/lisk/main/blockchain.db.gz\
 https://snapshot.liskwallet.net/blockchain.db.gz\
 https://snapshot.lisknode.io/blockchain.db.gz\
 https://lisktools.io/backups/blockchain.db.gz\
 https://snapshot.punkrock.me/blockchain.db.gz\
 https://snapshot.lsknode.org/blockchain.db.gz\
"

for source in ${SOURCES}; do 
  LMHEAD=`curl -m 5 -svI ${source} 2>&1 | grep '^< Last-Modified:'|sed 's/< Last-Modified://'`
  DATESTR=`date "+%Y%m%d%H%M%S%z" --date="${LMHEAD}"`
  echo ${DATESTR} ${source} ${LMHEAD}
done
