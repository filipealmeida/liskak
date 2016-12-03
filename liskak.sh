#!/usr/bin/env bash

vercomp () {
    if [[ $1 == $2 ]]
    then
        return 0
    fi
    local IFS=.
    local i ver1=($1) ver2=($2)
    # fill empty fields in ver1 with zeros
    for ((i=${#ver1[@]}; i<${#ver2[@]}; i++))
    do
        ver1[i]=0
    done
    for ((i=0; i<${#ver1[@]}; i++))
    do
        if [[ -z ${ver2[i]} ]]
        then
            # fill empty fields in ver2 with zeros
            ver2[i]=0
        fi
        if ((10#${ver1[i]} > 10#${ver2[i]}))
        then
            return 1
        fi
        if ((10#${ver1[i]} < 10#${ver2[i]}))
        then
            return 2
        fi
    done
    return 0
}

testvercomp () {
    vercomp $1 $2
    case $? in
        0) op='=';;
        1) op='>';;
        2) op='<';;
    esac
    if [[ $op != $3 ]]
    then
        return 1
    else
        return 0
    fi
}

check_cmds() {
  local cmds=("${!1}")
  for i in "${cmds[@]}"; do
    command -v "$i" > /dev/null 2>&1 || {
      echo "Error: $i command was not found. Aborting." >&2; exit 1;
    }
  done
}

CMDS=("node")
check_cmds CMDS[@]

NODE_VERSION_REQUIRED="4.0.0"
NODE_VERSION=$(node -v | sed s/^v//)
testvercomp ${NODE_VERSION} ${NODE_VERSION_REQUIRED} ">"
NODE_VERSION_COMPARE=$?

if [ ${NODE_VERSION_COMPARE} -gt 0 ]; then
    echo Bad node version ${NODE_VERSION}, you\'ll need at least ${NODE_VERSION_REQUIRED}
    exit 2;
fi

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

cd ${DIR} && node src/liskak.js $*
