import React from 'react';
import SearchBar from './SearchBar';
import './hostPage.css';
import SideBar from './SideBar';
import MusicLi from './MusicLi';
import { connect } from 'react-redux';
import api from '../api';
import { MdAdd } from 'react-icons/md';
import { MdCheck } from 'react-icons/md';
import {
    updatePlaylist,
    play,
    pause,
    updateRoomInfo,
    updateActiveMusic,
    updateActiveMusicState
} from '../redux/actions';
import io from 'socket.io-client';


const socket = io('http://localhost:1002');

let needNotify = false;

let likeDict = {};

class ConnectHostPage extends React.Component {


    constructor(props) {
        super(props);

        this.state = {
            tracks: [],     // store search result
            active: false,
        };

        this.GetResult = this.GetResult.bind(this);
        this.searchRef = React.createRef();
        this.initWs = this.initWs.bind(this);
        this.initWs();
    }

    initWs() {

        socket.on('refresh_play_list', () => {
            console.log('Guest: refresh_play_list received!!');
            this.clientRequestData()
            .then(data => {
                this.props.dispatch(updatePlaylist(data['tracks']));
            }).catch(console.error.bind(this));
        });
    }

    clientRequestData(){
        return api.checkPartyCode(this.state.roomId)
        .then(response => {
            if(response.status !== 200){
                alert('cannot join');
                return Promise.reject(response)
            }
            return response.json();
        })
    }

    playControl(event) {
        // {
        //     nextState: 'PAUSE' or 'PLAYING'
        //     uri,
        //     resume: boolean
        // }
        if (event.nextState === 'PAUSE') {
            return this.props.dispatch(pause(event.uri));
        } else if (event.nextState === 'PLAYING') {
            return this.props.dispatch(play(event));
        }
    }

    playNext() {
        if (this.props.musicInfo.length < 2) {
            alert('you can\'t play next when there is only one');
            return;
        }

        let prevUri = this.props.activeMusicUri;
        let nextUri = this.props.musicInfo[1].uri;
        let newMusicInfo = this.props.musicInfo;

        this.playControl({
            uri: nextUri,
            nextState: 'PLAYING',
            resume: false
        })
            .then(response => {
                let oldIndex = newMusicInfo.findIndex(e => e.uri === prevUri);
                newMusicInfo.splice(oldIndex, 1);
                this.props.dispatch(updatePlaylist(newMusicInfo));
                this.props.dispatch(updateActiveMusicState('PLAYING'));
                needNotify = true;
            });
    }

    removeAMusic(uri) {
        // remove a music that is not being played
        let newMusicInfo = this.props.musicInfo;
        let i = newMusicInfo.findIndex(e => e.uri === uri);
        newMusicInfo.splice(i, 1);
        console.log("spliced")
        this.props.dispatch(updatePlaylist(newMusicInfo));
        needNotify = true;
    }

    GetResult(searchItem) {
        if (searchItem) {
            api.searchItem(searchItem)
                .then(array => {
                    if (this.searchRef.current.state.searching) {
                        console.log('search outcome: ', array);
                        this.setState({
                            tracks: array,
                            active: true
                        });
                    }
                });
        } else {
            this.setState({ tracks: [] });
            this.setState({ active: false });
        }
    }

    componentDidMount() {
        if(this.props.iniAtLanding)
            return

        // refresh page at path /host
        api.createParty()
        .then(response => {
            return response.json();
        })
        .then(data => {
            this.props.dispatch( updateRoomInfo({
                userName: data.name,
                roomId: data.room_id,
                iniAtLanding: false
            }))
            this.props.dispatch(updatePlaylist(data['tracks']));
        })
        .catch(error => {
            console.error("host page: ", error)
            alert("error: see console")
        })
    }


    likeStateChanged(index, isLike) {
        console.log('index = ' + index + ', isLike = ' + isLike);
        let newList = Array.from(this.props.musicInfo);
        if (isLike) {
            likeDict[index] = 1;
            newList[index]['votes'] = newList[index]['votes'] + 1;
        } else {
            likeDict[index] = 0;
            newList[index]['votes'] = newList[index]['votes'] - 1;
        }
        this.props.dispatch(updatePlaylist(this.props.musicInfo));
        needNotify = true;


    }

    selectSearchItem(item) {
        console.log(item.selected)
        if (item.selected) {
            item.selected = false;
            for (let i = 0; i < this.props.musicInfo.length; i++) {
                if (this.props.musicInfo[i]['name'] === item['name']) {
                    this.props.musicInfo.splice(i, 1);
                    break;
                }
            }
        } else {
            item.selected = true;
            this.props.musicInfo[this.props.musicInfo.length] = {
                'play_state': 0,
                'votes': 0,
                'name': item['trackName'],
                'uri': item['uri'],
                'artist': item['artistName'],
                'album': item['albumName'],
                'albumIcon': {
                    'small': item.albumIcon['small'].url,
                    'large': item.albumIcon['large'].url
                }
            };
        }
        console.log("musicInfo " + JSON.stringify(this.props.musicInfo))
        this.props.dispatch(updatePlaylist(this.props.musicInfo));
        needNotify = true;
        // this.setState({
        //     tracks: this.state.tracks,
        //     active: true,
        //     musicInfo: this.state.musicInfo
        // });
    }

    render() {
        return (
            <div className={'hostPage'}>
                <SideBar userName={this.props.userName} roomId={this.props.roomId}> </SideBar>
                <div style={{ marginLeft: '260px' }}>
                    <SearchBar GetResult={this.GetResult} ref={this.searchRef}/>
                    <div className={'page'}>
                        <div className={'search-results ' + (this.state.active ? '' : 'hidden')}
                             onClick={() => {
                                 this.setState({ active: false });
                                 this.searchRef.current.state.searching = false;
                                 // this.savePlaylist();
                             }}>
                            {this.state.tracks.map((item, index) => {
                                return (
                                    <div className={'result'} key={index} onClick={event => {
                                        this.selectSearchItem(item);
                                        event.stopPropagation();
                                    }}>
                                        <div className="img">
                                            <img src={item.albumArt} alt=""/>
                                        </div>
                                        <div className={'info'}>
                                            <div className={'top'}>
                                                {item.trackName}
                                            </div>
                                            <div className={'bottom'}>
                                                <span className={'album-name'}>
                                                    {item.albumName}
                                                </span>
                                                <span className={'dot'}>.</span>
                                                <span className={'artist-name'}>
                                                    {item.artistName}
                                                </span>
                                            </div>
                                        </div>
                                        <div className={'addSong'} onClick={event => {
                                            this.selectSearchItem(item);
                                            event.stopPropagation();
                                        }}>
                                            {item.selected ?
                                                <MdCheck className={'icon'}> </MdCheck> :
                                                <MdAdd className={'icon'}>
                                                </MdAdd>}
                                        </div>

                                    </div>
                                );
                            })}
                        </div>
                        <div className={'tracklist'}>
                            {//todo Need to sort by votes, only sort from the second song and resort likeDict which storage local like state
                                this.props.musicInfo.length !== 0 ? this.props.musicInfo.map((entry, index) => {
                                    return (
                                        <MusicLi name={entry.name}
                                                 album={entry.album}
                                                 votes={entry.votes}
                                                 icon={entry.albumIcon['large']}
                                                 uri={entry.uri}
                                                 activeMusicUri={this.props.activeMusicUri}
                                                 playControl={this.playControl.bind(this)}
                                                 playNext={this.playNext.bind(this)}
                                                 removeAMusic={this.removeAMusic.bind(this)}
                                                 index={index}
                                                 key={entry.uri}
                                                 clickLike={this.likeStateChanged.bind(this)}
                                                 liked={likeDict[index] === 1}>
                                        </MusicLi>
                                    );
                                }) : <span className={'hint'}> Search to add musics </span>
                                // console.log(this.props.musicInfo)
                            }
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state, ownProps) => {
    api.uploadPlayList(state.roomId, state.musicInfo, () => {
        if (needNotify) {
            socket.emit('change_request', (data) => {
                // callback
                console.log('server responded: ', data);
            });
            needNotify = false;
        }
    });

    return {
        userName: state.userName,
        roomId: state.roomId,

        // existing playlist
        musicInfo: state.musicInfo,
        activeMusicUri: state.activeMusicUri
    };
};


// const mapDispatchToProps = dispatch => {
//     return {
//         refreshPlaylist: data => dispatch( refreshPlaylist(data) ),
//         play: data => dispatch( play(data) ),
//     };
// };


export const HostPage = connect(mapStateToProps, null)(ConnectHostPage);


// export default HostPage;
