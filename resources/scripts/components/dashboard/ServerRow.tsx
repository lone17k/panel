import React, { memo, useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEthernet, faHdd, faMemory, faMicrochip, faServer } from '@fortawesome/free-solid-svg-icons';
import { Link } from 'react-router-dom';
import { Server } from '@/api/server/getServer';
import getServerResourceUsage, { ServerPowerState, ServerStats } from '@/api/server/getServerResourceUsage';
import { bytesToString, ip, mbToBytes } from '@/lib/formatters';
import tw from 'twin.macro';
import GreyRowBox from '@/components/elements/GreyRowBox';
import Spinner from '@/components/elements/Spinner';
import styled from 'styled-components/macro';
import isEqual from 'react-fast-compare';

// Determines if the current value is in an alarm threshold so we can show it in red rather
// than the more faded default style.
const isAlarmState = (current: number, limit: number): boolean => limit > 0 && current / (limit * 1024 * 1024) >= 0.9;

const Icon = memo(
    styled(FontAwesomeIcon)<{ $alarm: boolean }>`
        ${(props) => (props.$alarm ? tw`text-red-400` : tw`text-neutral-500`)};
    `,
    isEqual
);

const IconDescription = styled.p<{ $alarm: boolean }>`
    ${tw`text-sm ml-2`};
    ${(props) => (props.$alarm ? tw`text-white` : tw`text-neutral-400`)};
`;

const StatusIndicatorBox = styled.div<{ $status: ServerPowerState | undefined }>`
    ${tw`flex flex-col bg-white/[0.03] border border-white/5 rounded-2xl p-5 transition-all duration-300 relative overflow-hidden mb-4 hover:bg-white/[0.06] hover:border-white/10 hover:shadow-2xl`};

    &::before {
        content: '';
        ${tw`absolute top-0 left-0 w-1 h-full transition-all duration-300`};
        ${({ $status }) =>
            !$status || $status === 'offline'
                ? tw`bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]`
                : $status === 'running'
                ? tw`bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]`
                : tw`bg-yellow-500 shadow-[0_0_15px_rgba(245,158,11,0.5)]`};
    }
`;

export default ({ server, className }: { server: Server; className?: string }) => {
    const interval = useRef<Timer>(null) as React.MutableRefObject<Timer>;
    const [isSuspended, setIsSuspended] = useState(server.status === 'suspended');
    const [stats, setStats] = useState<ServerStats | null>(null);

    const getStats = () =>
        getServerResourceUsage(server.uuid)
            .then((data) => setStats(data))
            .catch((error) => console.error(error));

    useEffect(() => {
        setIsSuspended(stats?.isSuspended || server.status === 'suspended');
    }, [stats?.isSuspended, server.status]);

    useEffect(() => {
        if (isSuspended) return;
        getStats().then(() => {
            interval.current = setInterval(() => getStats(), 30000);
        });
        return () => {
            interval.current && clearInterval(interval.current);
        };
    }, [isSuspended]);

    const alarms = { cpu: false, memory: false, disk: false };
    if (stats) {
        alarms.cpu = server.limits.cpu === 0 ? false : stats.cpuUsagePercent >= server.limits.cpu * 0.9;
        alarms.memory = isAlarmState(stats.memoryUsageInBytes, server.limits.memory);
        alarms.disk = server.limits.disk === 0 ? false : isAlarmState(stats.diskUsageInBytes, server.limits.disk);
    }

    const diskLimit = server.limits.disk !== 0 ? bytesToString(mbToBytes(server.limits.disk)) : 'Unlimited';
    const memoryLimit = server.limits.memory !== 0 ? bytesToString(mbToBytes(server.limits.memory)) : 'Unlimited';
    const cpuLimit = server.limits.cpu !== 0 ? server.limits.cpu + ' %' : 'Unlimited';

    return (
        <StatusIndicatorBox as={Link} to={`/server/${server.id}`} className={className} $status={stats?.status}>
            <div className={'flex flex-col sm:flex-row sm:items-center justify-between gap-4'}>
                <div className={'flex items-center flex-1'}>
                    <div className={'p-3 bg-white/5 rounded-xl mr-4'}>
                        <FontAwesomeIcon icon={faServer} className={'text-xl text-cyan-400'} />
                    </div>
                    <div>
                        <p className={'text-xl font-header font-semibold text-white'}>{server.name}</p>
                        <p className={'text-xs text-neutral-500 font-mono mt-0.5'}>
                            {server.allocations
                                .filter((alloc) => alloc.isDefault)
                                .map((allocation) => (
                                    <React.Fragment key={allocation.ip + allocation.port.toString()}>
                                        {allocation.alias || ip(allocation.ip)}:{allocation.port}
                                    </React.Fragment>
                                ))}
                        </p>
                    </div>
                </div>

                <div className={'flex items-center gap-6'}>
                    {!stats || isSuspended ? (
                        <div className={'flex items-center'}>
                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${isSuspended ? 'bg-red-500/20 text-red-400' : 'bg-neutral-500/20 text-neutral-400'}`}>
                                {isSuspended ? 'Suspended' : 'Loading...'}
                            </span>
                        </div>
                    ) : (
                        <>
                            <div className={'flex flex-col items-center min-w-[70px]'}>
                                <div className={'flex items-center gap-1.5'}>
                                    <FontAwesomeIcon icon={faMicrochip} className={`text-xs ${alarms.cpu ? 'text-red-400' : 'text-neutral-500'}`} />
                                    <p className={'text-sm font-semibold text-neutral-200'}>{stats.cpuUsagePercent.toFixed(0)}%</p>
                                </div>
                                <p className={'text-[10px] text-neutral-600 uppercase font-bold'}>CPU</p>
                            </div>
                            <div className={'flex flex-col items-center min-w-[70px]'}>
                                <div className={'flex items-center gap-1.5'}>
                                    <FontAwesomeIcon icon={faMemory} className={`text-xs ${alarms.memory ? 'text-red-400' : 'text-neutral-500'}`} />
                                    <p className={'text-sm font-semibold text-neutral-200'}>{bytesToString(stats.memoryUsageInBytes)}</p>
                                </div>
                                <p className={'text-[10px] text-neutral-600 uppercase font-bold'}>RAM</p>
                            </div>
                        </>
                    )}
                </div>
            </div>
            
            {!!server.description && (
                <p className={'text-sm text-neutral-500 mt-4 line-clamp-1 italic border-t border-white/5 pt-3'}>
                    {server.description}
                </p>
            )}
        </StatusIndicatorBox>
    );
};

