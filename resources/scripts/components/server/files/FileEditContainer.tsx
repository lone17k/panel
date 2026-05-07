import React, { useEffect, useState } from 'react';
import getFileContents from '@/api/server/files/getFileContents';
import { httpErrorToHuman } from '@/api/http';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import saveFileContents from '@/api/server/files/saveFileContents';
import FileManagerBreadcrumbs from '@/components/server/files/FileManagerBreadcrumbs';
import { useHistory, useLocation, useParams } from 'react-router';
import FileNameModal from '@/components/server/files/FileNameModal';
import Can from '@/components/elements/Can';
import FlashMessageRender from '@/components/FlashMessageRender';
import PageContentBlock from '@/components/elements/PageContentBlock';
import { ServerError } from '@/components/elements/ScreenBlock';
import tw from 'twin.macro';
import Button from '@/components/elements/Button';
import Select from '@/components/elements/Select';
import modes from '@/modes';
import useFlash from '@/plugins/useFlash';
import { ServerContext } from '@/state/server';
import { encodePathSegments, hashToPath } from '@/helpers';
import { dirname } from 'pathe';
import CodemirrorEditor from '@/components/elements/CodemirrorEditor';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faFile,
    faFolder,
    faCopy,
    faSearch,
    faCodeBranch,
    faBug,
    faBoxes,
    faChevronDown,
    faSave,
    faSync,
} from '@fortawesome/free-solid-svg-icons';
import vscode from './vscode.module.css';
import useFileManagerSwr from '@/plugins/useFileManagerSwr';

export default () => {
    const [error, setError] = useState('');
    const { action } = useParams<{ action: 'new' | string }>();
    const [loading, setLoading] = useState(action === 'edit');
    const [content, setContent] = useState('');
    const [modalVisible, setModalVisible] = useState(false);
    const [mode, setMode] = useState('text/plain');
    const [activeTab, setActiveTab] = useState('explorer');

    const history = useHistory();
    const { hash } = useLocation();

    const id = ServerContext.useStoreState((state) => state.server.data!.id);
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const setDirectory = ServerContext.useStoreActions((actions) => actions.files.setDirectory);
    const { addError, clearFlashes } = useFlash();

    const { data: files, mutate } = useFileManagerSwr();

    let fetchFileContent: null | (() => Promise<string>) = null;

    const path = hashToPath(hash);
    const filename = path.split('/').pop() || 'untitled';

    useEffect(() => {
        if (action === 'new') return;

        setError('');
        setLoading(true);
        const path = hashToPath(hash);
        setDirectory(dirname(path));
        getFileContents(uuid, path)
            .then(setContent)
            .catch((error) => {
                console.error(error);
                setError(httpErrorToHuman(error));
            })
            .then(() => setLoading(false));
    }, [action, uuid, hash]);

    const save = (name?: string) => {
        if (!fetchFileContent) {
            return;
        }

        setLoading(true);
        clearFlashes('files:view');
        fetchFileContent()
            .then((content) => saveFileContents(uuid, name || hashToPath(hash), content))
            .then(() => {
                if (name) {
                    history.push(`/server/${id}/files/edit#/${encodePathSegments(name)}`);
                    return;
                }

                return Promise.resolve();
            })
            .catch((error) => {
                console.error(error);
                addError({ message: httpErrorToHuman(error), key: 'files:view' });
            })
            .then(() => setLoading(false));
    };

    if (error) {
        return <ServerError message={error} onBack={() => history.goBack()} />;
    }

    return (
        <PageContentBlock>
            <FlashMessageRender byKey={'files:view'} css={tw`mb-4`} />

            <div className={vscode.container}>
                <div className={vscode.main_layout}>
                    {/* Activity Bar */}
                    <div className={vscode.activity_bar}>
                        <div
                            className={`${vscode.activity_icon} ${activeTab === 'explorer' ? vscode.active : ''}`}
                            onClick={() => setActiveTab('explorer')}
                        >
                            <FontAwesomeIcon icon={faCopy} size={'lg'} />
                        </div>
                        <div
                            className={`${vscode.activity_icon} ${activeTab === 'search' ? vscode.active : ''}`}
                            onClick={() => setActiveTab('search')}
                        >
                            <FontAwesomeIcon icon={faSearch} size={'lg'} />
                        </div>
                        <div className={vscode.activity_icon}>
                            <FontAwesomeIcon icon={faCodeBranch} size={'lg'} />
                        </div>
                        <div className={vscode.activity_icon}>
                            <FontAwesomeIcon icon={faBug} size={'lg'} />
                        </div>
                        <div className={vscode.activity_icon}>
                            <FontAwesomeIcon icon={faBoxes} size={'lg'} />
                        </div>
                    </div>

                    {/* Side Bar */}
                    <div className={vscode.side_bar}>
                        <div className={vscode.side_bar_header}>Explorer</div>
                        <div className={vscode.file_item} style={{ fontWeight: 600 }}>
                            <FontAwesomeIcon icon={faChevronDown} size={'xs'} />
                            <span>{dirname(path) || '/'}</span>
                        </div>
                        <div style={{ paddingLeft: '10px' }}>
                            {files?.map((file) => (
                                <div
                                    key={file.name}
                                    className={`${vscode.file_item} ${file.name === filename ? vscode.active : ''}`}
                                    onClick={() => {
                                        if (file.isFile) {
                                            history.push(
                                                `/server/${id}/files/edit#/${encodePathSegments(
                                                    (dirname(path) === '.' ? '' : dirname(path) + '/') + file.name
                                                )}`
                                            );
                                        }
                                    }}
                                >
                                    <FontAwesomeIcon
                                        icon={file.isFile ? faFile : faFolder}
                                        className={vscode.file_icon}
                                        style={{ color: file.isFile ? '#ccc' : '#e8a87c' }}
                                    />
                                    <span>{file.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Main Editor Area */}
                    <div className={vscode.editor_area}>
                        <div className={vscode.editor_header}>
                            <div className={`${vscode.tab} ${vscode.active}`}>
                                <FontAwesomeIcon icon={faFile} style={{ marginRight: '8px', fontSize: '12px' }} />
                                {filename}
                            </div>
                            <div css={tw`ml-auto flex items-center gap-2 pr-2`}>
                                <div className={vscode.status_item} title={'Save (Ctrl+S)'} onClick={() => save()}>
                                    <FontAwesomeIcon icon={faSave} />
                                </div>
                                <div className={vscode.status_item} title={'Reload'} onClick={() => mutate()}>
                                    <FontAwesomeIcon icon={faSync} />
                                </div>
                            </div>
                        </div>

                        <div className={vscode.breadcrumbs}>
                            <FileManagerBreadcrumbs withinFileEditor isNewFile={action !== 'edit'} />
                        </div>

                        {hash.replace(/^#/, '').endsWith('.pteroignore') && (
                            <div
                                css={tw`p-2 bg-blue-900 bg-opacity-30 border-l-4 border-blue-500 m-2 rounded text-xs text-blue-100`}
                            >
                                <p>
                                    You&apos;re editing a{' '}
                                    <code css={tw`font-mono bg-black bg-opacity-40 rounded px-1`}>.pteroignore</code>{' '}
                                    file. Files listed here are excluded from backups. Wildcards (*) and negations (!)
                                    are supported.
                                </p>
                            </div>
                        )}

                        <div css={tw`relative flex-1 overflow-hidden`}>
                            <SpinnerOverlay visible={loading} />
                            <CodemirrorEditor
                                mode={mode}
                                filename={hash.replace(/^#/, '')}
                                onModeChanged={setMode}
                                initialContent={content}
                                fetchContent={(value) => {
                                    fetchFileContent = value;
                                }}
                                onContentSaved={() => {
                                    if (action !== 'edit') {
                                        setModalVisible(true);
                                    } else {
                                        save();
                                    }
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* Status Bar */}
                <div className={vscode.status_bar}>
                    <div css={tw`flex items-center h-full`}>
                        <div className={vscode.status_item}>
                            <FontAwesomeIcon icon={faCodeBranch} style={{ marginRight: '5px' }} />
                            main*
                        </div>
                        <div className={vscode.status_item}>
                            <FontAwesomeIcon icon={faSync} style={{ marginRight: '5px' }} />
                            0
                        </div>
                    </div>
                    <div css={tw`flex items-center h-full`}>
                        <div className={vscode.status_item}>UTF-8</div>
                        <div className={vscode.status_item}>Spaces: 4</div>
                        <div className={vscode.status_item}>
                            <Select
                                value={mode}
                                onChange={(e) => setMode(e.currentTarget.value)}
                                css={tw`bg-transparent border-none text-xs p-0 h-auto focus:ring-0`}
                                style={{ color: 'inherit' }}
                            >
                                {modes.map((mode) => (
                                    <option key={`${mode.name}_${mode.mime}`} value={mode.mime}>
                                        {mode.name}
                                    </option>
                                ))}
                            </Select>
                        </div>
                    </div>
                </div>
            </div>

            <FileNameModal
                visible={modalVisible}
                onDismissed={() => setModalVisible(false)}
                onFileNamed={(name) => {
                    setModalVisible(false);
                    save(name);
                }}
            />

            <div css={tw`flex justify-end mt-4`}>
                {action === 'edit' ? (
                    <Can action={'file.update'}>
                        <Button css={tw`flex-1 sm:flex-none`} onClick={() => save()}>
                            Save Content
                        </Button>
                    </Can>
                ) : (
                    <Can action={'file.create'}>
                        <Button css={tw`flex-1 sm:flex-none`} onClick={() => setModalVisible(true)}>
                            Create File
                        </Button>
                    </Can>
                )}
            </div>
        </PageContentBlock>
    );
};
